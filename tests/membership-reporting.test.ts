import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canRunStandardMemberReportInDatabase,
  membershipReportOrderBy,
  membershipReportResultPayload,
  membershipReportSearchWhere,
  parseMembershipReportRequest
} from "@/lib/membership-reporting";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireEnabledModule: vi.fn(),
  databaseDynamicWhere: vi.fn(),
  dynamicMemberIds: vi.fn(),
  reportFindFirst: vi.fn(),
  customFieldsFindMany: vi.fn(),
  individualCount: vi.fn(),
  individualGroupBy: vi.fn(),
  individualFindMany: vi.fn(),
  memberTypeFindMany: vi.fn(),
  familyRoleFindMany: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/modules", () => ({ requireEnabledModule: mocks.requireEnabledModule }));
vi.mock("@/lib/tenant", () => ({
  requireTenantScope: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Report Manager", isPlatformAdmin: false, churchId: "church-1" },
    church: { id: "church-1", status: "ACTIVE" },
    isCrossTenant: false
  })
}));
vi.mock("@/lib/membership-audiences", () => ({
  databaseDynamicWhere: mocks.databaseDynamicWhere,
  dynamicMemberIds: mocks.dynamicMemberIds
}));
vi.mock("@/lib/db", () => ({
  db: {
    membershipReport: { findFirst: mocks.reportFindFirst },
    membershipCustomFieldDefinition: { findMany: mocks.customFieldsFindMany },
    membershipIndividual: {
      count: mocks.individualCount,
      groupBy: mocks.individualGroupBy,
      findMany: mocks.individualFindMany
    },
    membershipMemberType: { findMany: mocks.memberTypeFindMany },
    membershipFamilyRole: { findMany: mocks.familyRoleFindMany }
  }
}));

import { GET } from "@/app/api/membership/reports/[id]/results/route";

describe("membership report query helpers", () => {
  it("parses both DataTables and page-based request protocols", () => {
    const dataTables = parseMembershipReportRequest(new URLSearchParams(
      "draw=4&start=50&length=25&search%5Bvalue%5D=Smith&order%5B0%5D%5Bcolumn%5D=2&order%5B0%5D%5Bdir%5D=desc&columns%5B2%5D%5Bname%5D=memberNumber"
    ));
    expect(dataTables).toMatchObject({
      draw: 4,
      start: 50,
      length: 25,
      page: 3,
      pageSize: 25,
      search: "smith",
      sortKey: "memberNumber",
      sortDirection: "desc"
    });

    const paged = parseMembershipReportRequest(new URLSearchParams("page=2&pageSize=10&sort=email"));
    expect(paged).toMatchObject({ draw: null, page: 2, pageSize: 10, sortKey: "email" });
  });

  it("builds safe database search/order clauses and gates specialized execution", () => {
    expect(membershipReportSearchWhere("smith")).toEqual({
      OR: [
        { firstName: { contains: "smith", mode: "insensitive" } },
        { lastName: { contains: "smith", mode: "insensitive" } },
        { email: { contains: "smith", mode: "insensitive" } }
      ]
    });
    expect(membershipReportOrderBy("memberNumber", "desc")).toEqual([
      { memberNumber: "desc" },
      { firstName: "desc" }
    ]);
    expect(canRunStandardMemberReportInDatabase("membership-overview", "name", "status")).toBe(true);
    expect(canRunStandardMemberReportInDatabase("family-overview", "name", "status")).toBe(false);
    expect(canRunStandardMemberReportInDatabase("custom", "birthMonthDay", "")).toBe(false);
  });

  it("keeps the page response shape and filtered page count", () => {
    const request = parseMembershipReportRequest(new URLSearchParams("page=2&pageSize=10"));
    expect(membershipReportResultPayload({
      request,
      report: { id: "report-1" },
      rows: [{ id: "member-11", name: "Alex Smith" }],
      recordsTotal: 40,
      recordsFiltered: 11
    })).toEqual({
      report: { id: "report-1" },
      rows: [{ id: "member-11", name: "Alex Smith" }],
      total: 11,
      page: 2,
      pageSize: 10,
      pageCount: 2
    });
  });
});

describe("membership report results route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: "user-1", name: "Report Manager" });
    mocks.requireEnabledModule.mockResolvedValue(undefined);
    mocks.databaseDynamicWhere.mockReturnValue({ status: { not: "REMOVED" } });
    mocks.dynamicMemberIds.mockResolvedValue(["member-1", "member-2", "member-3", "member-4"]);
    mocks.reportFindFirst.mockResolvedValue({
      id: "report-1",
      name: "Members",
      reportType: "membership-overview",
      criteria: {},
      columns: [{ key: "memberNumber", label: "Member number" }, { key: "name", label: "Name" }],
      grouping: { key: "status", direction: "asc" },
      layout: {},
      striped: true
    });
    mocks.customFieldsFindMany.mockResolvedValue([]);
    mocks.individualCount.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    mocks.individualGroupBy.mockResolvedValue([
      { status: "ACTIVE", _count: { _all: 1 } },
      { status: "INACTIVE", _count: { _all: 1 } }
    ]);
    mocks.individualFindMany.mockResolvedValue([{
      id: "member-2",
      memberNumber: 2,
      firstName: "Alex",
      lastName: "Smith",
      status: "ACTIVE",
      gradeLevel: null,
      ageCategoryOverride: null,
      email: "alex@example.com",
      emailMessagesAllowed: true,
      cellphone: "5551234567",
      smsMessagesAllowed: false,
      memberType: { name: "Member" },
      familyRole: { name: "Adult" },
      customValues: [],
      familyId: "family-1",
      family: {
        lastName: "Smith",
        status: "ACTIVE",
        addressStreet: "1 Main St",
        addressCity: "Hillside",
        addressState: "IL",
        addressZip: "60000",
        phone: null,
        customValues: []
      },
      volunteerGroups: [],
      volunteerAssignmentHistory: [],
      otherPhone: null,
      otherPhoneType: null,
      maritalStatus: "SINGLE",
      gender: "MALE",
      birthday: new Date("2000-02-03T00:00:00.000Z"),
      weddingDate: null,
      deceasedDate: null
    }]);
  });

  it("returns DataTables protocol counts while fetching only the requested member page", async () => {
    const response = await GET(new Request(
      "http://localhost/api/membership/reports/report-1/results?draw=9&start=25&length=25&search%5Bvalue%5D=Smith&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=desc&columns%5B0%5D%5Bname%5D=memberNumber"
    ), { params: { id: "report-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      draw: 9,
      recordsTotal: 4,
      recordsFiltered: 2,
      data: [{ id: "member-2", memberNumber: 2, name: "Alex Smith" }],
      report: {
        id: "report-1",
        grouping: "status",
        groupingCounts: [{ label: "ACTIVE", count: 1 }, { label: "INACTIVE", count: 1 }],
        summary: { total: 2, active: 1, inactive: 1 }
      }
    });
    expect(mocks.individualFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 25,
      take: 25,
      orderBy: [{ memberNumber: "desc" }, { firstName: "desc" }],
      where: {
        churchId: "church-1",
        status: { not: "REMOVED" },
        OR: [
          { firstName: { contains: "smith", mode: "insensitive" } },
          { lastName: { contains: "smith", mode: "insensitive" } },
          { email: { contains: "smith", mode: "insensitive" } }
        ]
      }
    }));
    expect(mocks.dynamicMemberIds).not.toHaveBeenCalled();
  });

  it("retains evaluated audience IDs while database-paging the normal response protocol", async () => {
    mocks.databaseDynamicWhere.mockReturnValue(null);
    const response = await GET(new Request(
      "http://localhost/api/membership/reports/report-1/results?page=2&pageSize=10"
    ), { params: { id: "report-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      total: 2,
      page: 2,
      pageSize: 10,
      pageCount: 1,
      rows: [{ id: "member-2", name: "Alex Smith" }]
    });
    expect(mocks.dynamicMemberIds).toHaveBeenCalledWith({});
    expect(mocks.individualFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: { churchId: "church-1", id: { in: ["member-1", "member-2", "member-3", "member-4"] } }
    }));
  });
});
