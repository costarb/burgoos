import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const bodyLimit = process.env.API_BODY_LIMIT ?? "10mb";

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: allowedOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const config = new DocumentBuilder()
    .setTitle("BurgoOS API")
    .setDescription("Delivery pilot API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();

function allowedOrigins(): string[] {
  const configured = process.env.WEB_ORIGIN;
  if (configured) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}
