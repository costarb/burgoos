import { INestApplication, Provider, Type, ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { validateEnvironment } from "../../src/config/env.validation";
import { AuthService } from "../../src/platform/auth/auth.service";
import { PrismaService } from "../../src/platform/database/prisma.service";
import type { McpFakePrisma } from "./mcp-fake-prisma";

/**
 * Boots only the controllers and providers a test needs. Booting the whole AppModule under
 * Vitest is not possible today: esbuild emits no decorator metadata and many existing providers
 * rely on it, so the MCP tests compose a focused module instead (every MCP class uses explicit
 * @Inject tokens).
 */
export async function createMcpTestApp(input: {
  prisma: McpFakePrisma;
  controllers: Type<unknown>[];
  providers: Provider[];
  authService?: Partial<AuthService>;
  env?: Record<string, string>;
}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        validate: () => validateEnvironment({ ...input.env }),
      }),
    ],
    controllers: input.controllers,
    providers: [
      { provide: PrismaService, useValue: input.prisma },
      { provide: AuthService, useValue: input.authService ?? { verifyAccessToken: async () => null } },
      ...input.providers,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  await app.init();
  return app;
}
