import "reflect-metadata";
import * as fs from "node:fs";
import * as path from "node:path";
import { load } from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { IfoodFinancialController } from "../src/management/sales-integrations/ifood/ifood-financial.controller";
import { SalesImportController } from "../src/management/sales-integrations/sales-import.controller";
import { REQUIRED_PERMISSION_KEY } from "../src/auth/guards/require-permission.decorator";
import { JwtAuthGuard } from "../src/platform/auth/jwt-auth.guard";
import { PermissionGuard } from "../src/auth/guards/permission.guard";

type OpenApiSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  $ref?: string;
  allOf?: OpenApiSchema[];
};
type OpenApiOperation = {
  security?: unknown[];
  responses: Record<string, { content?: { "application/json"?: { schema: OpenApiSchema } } }>;
};
type OpenApiDoc = {
  servers: { url: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: Record<string, OpenApiSchema> };
};

const CONTRACT_PATH = path.join(
  __dirname,
  "../../../specs/021-ifood-financial-sales/contracts/ifood-financial-admin.openapi.yaml"
);

function loadContract(): OpenApiDoc {
  const raw = fs.readFileSync(CONTRACT_PATH, "utf8");
  return load(raw) as OpenApiDoc;
}

function resolveSchema(doc: OpenApiDoc, schema: OpenApiSchema): OpenApiSchema {
  if (schema.$ref) {
    const name = schema.$ref.replace("#/components/schemas/", "");
    const target = doc.components.schemas[name];
    if (!target) throw new Error(`Unresolved schema ref: ${schema.$ref}`);
    return resolveSchema(doc, target);
  }
  return schema;
}

/**
 * Contract paths use {param}; Nest route templates use :param. Normalize both to a
 * structural shape (param names don't have to match, only position and literal segments).
 */
function normalizeTemplate(segment: string): string {
  return segment
    .replace(/\{[^}]+\}/g, ":param")
    .replace(/:[A-Za-z0-9_]+/g, ":param")
    .replace(/\/+$/, "");
}

function joinPath(prefix: string, suffix: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const cleanSuffix = suffix.replace(/^\/+|\/+$/g, "");
  return ["", cleanPrefix, cleanSuffix].filter(Boolean).join("/") || "/";
}

type RouteEntry = {
  fullPath: string;
  httpMethod: keyof typeof RequestMethod;
  methodName: string;
  controller: unknown;
};

function collectRoutes(
  ControllerClass: new (...args: never[]) => unknown,
  globalPrefix: string
): RouteEntry[] {
  const controllerPrefix: string = Reflect.getMetadata(PATH_METADATA, ControllerClass) ?? "";
  const routes: RouteEntry[] = [];
  const prototype = ControllerClass.prototype as Record<string, object>;
  for (const key of Object.getOwnPropertyNames(prototype)) {
    if (key === "constructor") continue;
    const handler = prototype[key];
    const methodPath = Reflect.getMetadata(PATH_METADATA, handler);
    const method = Reflect.getMetadata(METHOD_METADATA, handler);
    if (methodPath === undefined || method === undefined) continue;
    routes.push({
      fullPath: normalizeTemplate(joinPath(joinPath(globalPrefix, controllerPrefix), methodPath)),
      httpMethod: RequestMethod[method as number] as keyof typeof RequestMethod,
      methodName: key,
      controller: ControllerClass,
    });
  }
  return routes;
}

function assertRequiredKeysPresent(
  doc: OpenApiDoc,
  schema: OpenApiSchema,
  value: unknown,
  contextLabel: string
) {
  const resolved = resolveSchema(doc, schema);
  if (!resolved.required) return;
  expect(value, `${contextLabel} response`).toBeTruthy();
  for (const key of resolved.required) {
    expect(
      value && typeof value === "object" && key in (value as Record<string, unknown>),
      `${contextLabel} is missing required contract field "${key}"`
    ).toBe(true);
  }
}

describe("iFood financial admin OpenAPI parity", () => {
  const doc = loadContract();
  const apiPrefix = doc.servers[0]?.url.replace(/^\/+|\/+$/g, "") ?? "";

  const controllers = [
    {
      name: "IfoodFinancialController",
      routes: collectRoutes(IfoodFinancialController, apiPrefix),
    },
    { name: "SalesImportController", routes: collectRoutes(SalesImportController, apiPrefix) },
  ];
  const allRoutes = controllers.flatMap((c) => c.routes);

  const contractOperations = Object.entries(doc.paths).flatMap(([contractPath, operations]) =>
    Object.entries(operations)
      .filter(([method]) => method !== "parameters")
      .map(([method, operation]) => ({
        fullPath: normalizeTemplate(joinPath(apiPrefix, contractPath)),
        httpMethod: method.toUpperCase() as keyof typeof RequestMethod,
        operation,
      }))
  );

  it("documents at least one operation for every declared contract path", () => {
    expect(contractOperations.length).toBeGreaterThan(0);
  });

  it.each(contractOperations.map((op) => [`${op.httpMethod} ${op.fullPath}`, op] as const))(
    "implements %s with a matching controller route",
    (_label, { fullPath, httpMethod }) => {
      const match = allRoutes.find(
        (route) => route.fullPath === fullPath && route.httpMethod === httpMethod
      );
      expect(match, `no controller route matches ${httpMethod} ${fullPath}`).toBeDefined();
    }
  );

  it("does not expose undocumented bearer-secured admin routes for these controllers", () => {
    // Every implemented route on these controllers must be traceable to a contract entry,
    // except provider-neutral list/movement endpoints that intentionally extend the base
    // sales-import-runs contract surface.
    const documented = new Set(contractOperations.map((op) => `${op.httpMethod} ${op.fullPath}`));
    const undocumented = allRoutes
      .map((route) => `${route.httpMethod} ${route.fullPath}`)
      .filter((key) => !documented.has(key));
    expect(undocumented).toEqual([]);
  });

  for (const { name, routes } of controllers) {
    it(`requires JwtAuthGuard and PermissionGuard on every ${name} route`, () => {
      const ControllerClass = routes[0]?.controller as new (...args: never[]) => unknown;
      const classGuards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, ControllerClass) ?? [];
      expect(classGuards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionGuard]));
      for (const route of routes) {
        const prototype = ControllerClass.prototype as Record<string, object>;
        const permissions = Reflect.getMetadata(
          REQUIRED_PERMISSION_KEY,
          prototype[route.methodName]
        );
        expect(permissions, `${route.methodName} must declare a required permission`).toBeDefined();
        expect((permissions as string[]).length).toBeGreaterThan(0);
      }
    });
  }

  describe("response schema parity", () => {
    function setupIfoodController() {
      const readiness = {
        get: vi.fn().mockResolvedValue({
          integrationId: "integration",
          status: "READY_TEST",
          environment: "TEST",
          merchantId: "merchant-1",
          permissions: [],
          productionEnabled: false,
          lastValidatedAt: null,
          checks: [],
        }),
      };
      const service = {
        listRuns: vi.fn().mockResolvedValue([
          {
            id: "run-1",
            status: "COMPLETED",
            trigger: "MANUAL",
            startDate: new Date("2026-08-01"),
            endDate: new Date("2026-08-31"),
            salesCount: 1,
            eventCount: 2,
            settlementCount: 1,
            divergentCount: 0,
            errorCode: null,
            errorMessage: null,
          },
        ]),
      };
      const processor = {};
      return new IfoodFinancialController(service as never, processor as never, readiness as never);
    }

    it("GET readiness satisfies the Readiness schema", async () => {
      const controller = setupIfoodController();
      const user = { id: "user", tenantId: "tenant" } as never;
      const result = await controller.getReadiness(user, "integration");
      assertRequiredKeysPresent(
        doc,
        { $ref: "#/components/schemas/Readiness" },
        result,
        "GET readiness"
      );
    });

    it("GET financial-reconciliations list satisfies the wrapped ReconciliationRun schema", async () => {
      const controller = setupIfoodController();
      const user = { id: "user", tenantId: "tenant" } as never;
      const result = await controller.list(user, "integration");
      expect(Array.isArray(result.items)).toBe(true);
      for (const item of result.items) {
        assertRequiredKeysPresent(
          doc,
          { $ref: "#/components/schemas/ReconciliationRun" },
          item,
          "GET financial-reconciliations item"
        );
        assertRequiredKeysPresent(
          doc,
          {
            type: "object",
            required: ["sales", "events", "settlements", "divergent"],
          },
          item.counts,
          "GET financial-reconciliations item.counts"
        );
      }
    });

    it("GET sales-import-runs/:id satisfies the ImportRun schema", async () => {
      const run = {
        id: "run-1",
        provider: "IFOOD",
        status: "PREVIEW_READY",
        startDate: new Date("2026-08-01"),
        endDate: new Date("2026-08-31"),
        counts: { existing: 1, candidate: 2 },
        errorCode: null,
        errorMessage: null,
      };
      const previewService = { get: vi.fn().mockResolvedValue(run) };
      const confirmation = {};
      const history = {};
      const processor = {};
      const controller = new SalesImportController(
        previewService as never,
        confirmation as never,
        history as never,
        processor as never
      );
      const user = { id: "user", tenantId: "tenant" } as never;
      const result = await controller.get(user, "run-1");
      assertRequiredKeysPresent(doc, { $ref: "#/components/schemas/ImportRun" }, result, "GET run");
    });
  });
});
