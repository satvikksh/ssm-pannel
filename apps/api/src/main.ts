import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { loadConfig, ConfigError } from "@smm/config";
import { createNestLogger } from "@smm/logger";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { HttpAdapterHost } from "@nestjs/core";

async function bootstrap() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(
      error instanceof ConfigError
        ? error.message
        : "Failed to load configuration. " + String(error),
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = createNestLogger({ name: "api" });
  app.useLogger(logger);

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  app.setGlobalPrefix("api/v1", { exclude: ["health", "ready"] });
  app.use(helmet());
  // User panel (3000) and admin panel (3001) are always allowed; extra
  // origins (comma-separated CORS_ORIGINS) and APP_URL (production) are merged in.
  const corsOrigins = (config.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    ...corsOrigins,
    ...(config.NODE_ENV === "production" ? [config.APP_URL] : []),
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  if (process.env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("SMM Panel API")
      .setDescription("Customer SMM panel REST API with versioned endpoints.")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = config.PORT;
  await app.listen(port);
  logger.info(`API listening on port ${port}`, { requestId: "bootstrap" });
}

void bootstrap();