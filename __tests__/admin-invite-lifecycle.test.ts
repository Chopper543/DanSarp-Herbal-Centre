import crypto from "crypto";
import { createAdminInvite, acceptInvite, revokeInvite } from "@/lib/auth/invite";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

describe("Admin invite lifecycle", () => {
  const mockedCreateClient = createClient as jest.Mock;
  const mockedCreateServiceClient = createServiceClient as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://dansarp.test";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates an admin invite and returns invite URL", async () => {
    const token = "abcd".repeat(16);
    jest
      .spyOn(crypto, "randomBytes")
      .mockImplementation(() => Buffer.from(token, "hex") as any);

    const inviteRecord = {
      id: "invite-id",
      email: "newadmin@example.com",
      role: "admin",
      token,
      invited_by: "inviter-id",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      accepted_at: null,
      created_at: new Date().toISOString(),
    };

    mockedCreateClient.mockResolvedValue({
      from: (table: string) => {
        if (table !== "admin_invites") throw new Error("Unexpected table");
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: inviteRecord, error: null }),
            }),
          }),
        };
      },
    });

    const result = await createAdminInvite("newadmin@example.com", "admin", "inviter-id");
    expect(result.token).toBe(token);
    expect(result.inviteUrl).toBe(`https://dansarp.test/admin/invite/${token}`);
  });

  it("accepts invite using service-role path and updates role + accepted_at", async () => {
    const updateUsers = jest.fn();
    const updateInvites = jest.fn();

    mockedCreateServiceClient.mockReturnValue({
      from: (table: string) => {
        if (table === "admin_invites") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "invite-id",
                    email: "staff@example.com",
                    role: "appointment_manager",
                    token: "token-123",
                    invited_by: "inviter-id",
                    expires_at: new Date(Date.now() + 3600000).toISOString(),
                    accepted_at: null,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              updateInvites(payload);
              return {
                eq: async () => ({ error: null }),
              };
            },
          };
        }

        if (table === "users") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { email: "staff@example.com" },
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              updateUsers(payload);
              return {
                eq: async () => ({ error: null }),
              };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    });

    const result = await acceptInvite("token-123", "user-123");
    expect(result).toBe(true);
    expect(updateUsers).toHaveBeenCalledWith({ role: "appointment_manager" });
    expect(updateInvites).toHaveBeenCalledWith(
      expect.objectContaining({ accepted_at: expect.any(String) })
    );
  });

  it("revokes invite via service-role client", async () => {
    const deleteCalled = jest.fn();
    mockedCreateServiceClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "admin_invites") throw new Error("Unexpected table");
        return {
          delete: () => ({
            eq: async () => {
              deleteCalled();
              return { error: null };
            },
          }),
        };
      },
    });

    await revokeInvite("invite-1");
    expect(deleteCalled).toHaveBeenCalledTimes(1);
  });
});
