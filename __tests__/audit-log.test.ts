/**
 * @jest-environment node
 *
 * Locks the audit log writer's column mapping: pre/post snapshots must land
 * in dedicated `old_data` / `new_data` columns (where the admin-only RLS
 * policy guards them), IP in dedicated `ip_address` column, with extra
 * request fields kept in metadata for traceability.
 */

// jest.mock() is hoisted; declare mocks INSIDE the factory and re-resolve via
// require() in tests so the references are evaluated after initialization.
//
// Audit writes go through the SERVICE-ROLE client (audit_logs is RLS-locked,
// so a user-scoped client would be rejected). createServiceClient is
// synchronous and must never be the real one in tests (it throws without env).
jest.mock("@/lib/supabase/service", () => {
  const insertMock = jest.fn().mockResolvedValue({ error: null });
  const supabaseFromMock = jest.fn().mockImplementation(() => ({ insert: insertMock }));
  const createServiceClient = jest.fn(() => ({ from: supabaseFromMock }));
  return {
    createServiceClient,
    __mocks__: { insertMock, supabaseFromMock, createServiceClient },
  };
});

jest.mock("@/lib/monitoring/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { logAuditEvent } from "../lib/audit/log";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mocks__ } = require("@/lib/supabase/service");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { logger } = require("@/lib/monitoring/logger");
const insertMock: jest.Mock = __mocks__.insertMock;
const supabaseFromMock: jest.Mock = __mocks__.supabaseFromMock;
const createServiceClient: jest.Mock = __mocks__.createServiceClient;
const loggerErrorMock: jest.Mock = logger.error;

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  supabaseFromMock.mockClear();
  createServiceClient.mockClear();
  loggerErrorMock.mockReset();
});

describe("logAuditEvent — column routing", () => {
  it("routes oldData and newData into dedicated columns (not metadata)", async () => {
    await logAuditEvent({
      userId: "u1",
      action: "update_clinical_note",
      resourceType: "clinical_note",
      resourceId: "note1",
      oldData: { plan: "old plan" },
      newData: { plan: "new plan" },
    });
    expect(supabaseFromMock).toHaveBeenCalledWith("audit_logs");
    const row = insertMock.mock.calls[0][0];
    expect(row.old_data).toEqual({ plan: "old plan" });
    expect(row.new_data).toEqual({ plan: "new plan" });
    // Must NOT have leaked into metadata
    expect(row.metadata.old_data).toBeUndefined();
    expect(row.metadata.new_data).toBeUndefined();
  });

  it("routes request IP into ip_address column (not metadata)", async () => {
    await logAuditEvent({
      userId: "u1",
      action: "read_patient_record",
      resourceType: "patient_record",
      resourceId: "p1",
      requestInfo: { ip: "10.0.0.1", userAgent: "agent", path: "/api/x" },
    });
    const row = insertMock.mock.calls[0][0];
    expect(row.ip_address).toBe("10.0.0.1");
    expect(row.metadata.request_user_agent).toBe("agent");
    expect(row.metadata.request_path).toBe("/api/x");
    expect(row.metadata.request_ip).toBeUndefined();
  });

  it("omits old_data/new_data as null when not supplied", async () => {
    await logAuditEvent({
      userId: "u1",
      action: "list_lab_results",
      resourceType: "lab_result",
    });
    const row = insertMock.mock.calls[0][0];
    expect(row.old_data).toBeNull();
    expect(row.new_data).toBeNull();
  });

  it("does not throw on a DB insert error (audit is fire-and-forget)", async () => {
    insertMock.mockResolvedValue({ error: { message: "boom" } });
    await expect(
      logAuditEvent({
        userId: "u1",
        action: "x",
        resourceType: "y",
      })
    ).resolves.toBeUndefined();
  });
});

describe("logAuditEvent — write path + failure escalation", () => {
  it("writes through the service-role client (bypasses RLS), not a user client", async () => {
    await logAuditEvent({
      userId: "u1",
      action: "read_clinical_note",
      resourceType: "clinical_note",
      resourceId: "note1",
    });
    expect(createServiceClient).toHaveBeenCalledTimes(1);
    expect(supabaseFromMock).toHaveBeenCalledWith("audit_logs");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("escalates a DB insert error via logger.error (never silent)", async () => {
    insertMock.mockResolvedValue({ error: { message: "rls denied" } });
    await logAuditEvent({
      userId: "u1",
      action: "read_lab_result",
      resourceType: "lab_result",
      resourceId: "lab1",
    });
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock.mock.calls[0][0]).toMatch(/audit log insert failed/i);
    // context carries the action so a broken trail is diagnosable
    expect(loggerErrorMock.mock.calls[0][2]).toEqual(
      expect.objectContaining({ action: "read_lab_result", resourceId: "lab1" })
    );
  });

  it("escalates (and swallows) a thrown client error without taking down the caller", async () => {
    createServiceClient.mockImplementationOnce(() => {
      throw new Error("service client misconfigured");
    });
    await expect(
      logAuditEvent({ userId: "u1", action: "read_patient_record", resourceType: "patient_record" })
    ).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock.mock.calls[0][0]).toMatch(/audit log write threw/i);
  });
});

// P0 audit-log integrity: writer uses the service-role client against an
// RLS-locked, write-once-read-many audit_logs table. See migration
// 20260628000001_audit_log_integrity.sql.
