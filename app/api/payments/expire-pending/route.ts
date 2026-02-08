import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { paymentService } from "@/lib/payments/payment-service";

export async function POST(request: NextRequest) {
  try {
    // Verify this is called by cron job (add secret for security)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Find pending payments older than 1 hour that have a provider_transaction_id
    // @ts-ignore - Supabase type inference issue
    const { data: pendingPayments, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("status", "pending")
      .lt("created_at", oneHourAgo)
      .not("provider_transaction_id", "is", null);

    if (fetchError) {
      console.error("Error fetching pending payments:", fetchError);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 400 }
      );
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      return NextResponse.json({
        message: "No pending payments to expire",
        expired: 0,
        verified_completed: 0,
        marked_failed: 0,
        total_checked: 0,
      });
    }

    let expiredCount = 0;
    let verifiedCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each pending payment
    for (const payment of pendingPayments) {
      try {
        // Type cast payment to access properties
        const typedPayment = payment as {
          id: string;
          provider: string;
          provider_transaction_id: string;
          metadata: any;
        };

        // Custom Ghana rails provider relies on webhook updates.
        if (typedPayment.provider === "custom") {
          const providerStatus = typedPayment.metadata?.provider_status;

          if (providerStatus === "completed") {
            // @ts-ignore - Supabase type inference issue
            await supabase
              .from("payments")
              // @ts-ignore
              .update({
                status: "completed",
                metadata: {
                  ...(typedPayment.metadata || {}),
                  completed_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", typedPayment.id);

            verifiedCount++;
            results.push({
              payment_id: typedPayment.id,
              action: "webhook_completed",
              provider_status: providerStatus,
            });
            continue;
          }

          if (providerStatus === "failed") {
            // @ts-ignore - Supabase type inference issue
            await supabase
              .from("payments")
              // @ts-ignore
              .update({
                status: "failed",
                metadata: {
                  ...(typedPayment.metadata || {}),
                  failed_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", typedPayment.id);

            failedCount++;
            results.push({
              payment_id: typedPayment.id,
              action: "webhook_failed",
              provider_status: providerStatus,
            });
            continue;
          }

          // Still pending after grace period - expire
          // @ts-ignore - Supabase type inference issue
          await supabase
            .from("payments")
            // @ts-ignore - Supabase type inference issue
            .update({
              status: "expired",
              metadata: {
                ...(typedPayment.metadata || {}),
                expired_at: new Date().toISOString(),
                expiration_reason: "No provider confirmation after 1 hour (custom rails)",
                last_known_provider_status: providerStatus || "pending",
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", typedPayment.id);

          expiredCount++;
          results.push({
            payment_id: typedPayment.id,
            action: "expired_custom_pending",
            provider_status: providerStatus || "pending",
          });
          continue;
        }

        // Verify with payment provider before marking as expired
        const verification = await paymentService.verifyPayment(
          typedPayment.provider,
          typedPayment.provider_transaction_id
        );

        if (verification.status === "completed") {
          // Payment was actually completed - update status
          // @ts-ignore - Supabase type inference issue
          await supabase
            .from("payments")
            // @ts-ignore - Supabase type inference issue
            .update({
              status: "completed",
              metadata: verification.metadata || typedPayment.metadata,
              updated_at: new Date().toISOString(),
            })
            .eq("id", typedPayment.id);

          verifiedCount++;
          results.push({
            payment_id: typedPayment.id,
            action: "verified_completed",
            provider_status: verification.status,
          });
        } else if (verification.status === "failed") {
          // Payment failed - update status
          // @ts-ignore - Supabase type inference issue
          await supabase
            .from("payments")
            // @ts-ignore - Supabase type inference issue
            .update({
              status: "failed",
              metadata: verification.metadata || typedPayment.metadata,
              updated_at: new Date().toISOString(),
            })
            .eq("id", typedPayment.id);

          failedCount++;
          results.push({
            payment_id: typedPayment.id,
            action: "marked_failed",
            provider_status: verification.status,
          });
        } else if (verification.status === "pending" || verification.status === "processing") {
          // Still pending after 1 hour - mark as expired
          // @ts-ignore - Supabase type inference issue
          await supabase
            .from("payments")
            // @ts-ignore - Supabase type inference issue
            .update({
              status: "expired",
              metadata: {
                ...(typedPayment.metadata || {}),
                expired_at: new Date().toISOString(),
                expiration_reason: "No confirmation received after 1 hour",
                last_verification_status: verification.status,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", typedPayment.id);

          expiredCount++;
          results.push({
            payment_id: typedPayment.id,
            action: "expired",
            provider_status: verification.status,
          });
        }
      } catch (error: any) {
        // If verification fails, mark as expired anyway (provider might be down)
        const typedPayment = payment as {
          id: string;
          metadata: any;
        };
        console.error(`Error verifying payment ${typedPayment.id}:`, error);
        // @ts-ignore - Supabase type inference issue
        await supabase
          .from("payments")
          // @ts-ignore - Supabase type inference issue
          .update({
            status: "expired",
            metadata: {
              ...(typedPayment.metadata || {}),
              expired_at: new Date().toISOString(),
              expiration_reason: `Verification failed: ${error.message}`,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", typedPayment.id);

        expiredCount++;
        results.push({
          payment_id: typedPayment.id,
          action: "expired_verification_failed",
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      message: "Payment expiration check completed",
      total_checked: pendingPayments.length,
      expired: expiredCount,
      verified_completed: verifiedCount,
      marked_failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error("Error in expire-pending job:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing (with auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
