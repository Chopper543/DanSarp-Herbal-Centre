import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paymentId } = await params;

    // @ts-ignore - Supabase type inference issue with payments table
    const { data: payment, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const typedPayment = payment as {
      id: string;
      created_at: string;
      amount: string | number;
      payment_method: string | null;
      status: string;
    };

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 800;

    // Title
    page.drawText("Payment Receipt", {
      x: 50,
      y,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    y -= 50;

    // Payment Details
    page.drawText("Payment Details", {
      x: 50,
      y,
      size: 16,
      font: boldFont,
    });

    y -= 30;

    const details = [
      ["Receipt Number:", typedPayment.id.slice(0, 8).toUpperCase()],
      ["Date:", new Date(typedPayment.created_at).toLocaleDateString()],
      ["Amount:", `GHS ${parseFloat(String(typedPayment.amount || 0)).toFixed(2)}`],
      ["Payment Method:", typedPayment.payment_method?.replace("_", " ").toUpperCase() || "N/A"],
      ["Status:", typedPayment.status.toUpperCase()],
    ];

    details.forEach(([label, value]) => {
      page.drawText(label, {
        x: 50,
        y,
        size: 12,
        font,
      });
      page.drawText(value, {
        x: 200,
        y,
        size: 12,
        font: boldFont,
      });
      y -= 25;
    });

    // Footer
    y = 100;
    page.drawText("Thank you for your payment!", {
      x: 50,
      y,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="receipt-${typedPayment.id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
