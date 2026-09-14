import { resolve } from "node:path";
import { loadConfig } from "@smm/config";
import { getModel, userSchema } from "@smm/database";
import { loadDotEnvIfPresent } from "../src/env";
import { connectCustomerDb, createJobServiceGraph } from "@smm/domain";

async function main() {
  loadDotEnvIfPresent(resolve(__dirname, "../.env"));
  const config = loadConfig();

  await connectCustomerDb(config.MONGODB_URI);
  const graph = createJobServiceGraph(config.REDIS_URL);
  const UserModel = getModel("User", userSchema);

  const now = Date.now();
  const nowStamp = now.toString(36);

  const category = await graph.models.Category.create({
    name: `E2E Cat ${now}`,
    slug: `e2e-cat-${nowStamp}`,
    sortOrder: 0,
    status: "active",
    visibility: true,
  });

  const provider = await graph.models.Provider.create({
    name: "E2E Fake Provider",
    slug: `e2e-fake-${nowStamp}`,
    adapter: "fake",
    baseUrl: "https://fake.local",
    status: "active",
    config: {},
    currency: "USD",
    timeoutMs: 10000,
    retries: 3,
  });

  const service = await graph.models.Service.create({
    name: "E2E Instagram Followers",
    slug: `e2e-svc-${nowStamp}`,
    serviceType: "followers",
    categoryId: category._id,
    providerId: provider._id,
    providerServiceId: "1",
    providerCost: 0.5,
    customerPrice: 1.0,
    minimum: 10,
    maximum: 10000,
    refillSupported: true,
    cancelSupported: true,
    dripFeedSupported: false,
    subscriptionSupported: false,
    status: "active",
    visibility: true,
    sortOrder: 0,
  });

  const user = await UserModel.create({
    username: `e2e-user-${nowStamp}`,
    email: `e2e-user-${nowStamp}@smm.test`,
    passwordHash: "e2e-only",
    referralCode: `ref-${nowStamp}`,
    role: "user",
    status: "active",
  });

  const wallet = await graph.walletService.ensureWallet(user._id.toString());
  wallet.balance = 500;
  wallet.currency = "USD";
  await wallet.save();

  const placed = await graph.ordersService.create({
    serviceId: service._id.toString(),
    link: "https://instagram.com/p/e2e-check",
    quantity: 20,
    userId: user._id.toString(),
  });
  const orderId = placed.order.id as string;
  console.log("order placed:", orderId, "status:", placed.order.status);

  const started = Date.now();
  let final;
  while (Date.now() - started < 60_000) {
    final = await graph.models.Order.findById(orderId)
      .select("status providerOrderId startCount remains")
      .lean();
    if (["completed", "failed", "canceled", "refunded"].includes(final?.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("final order:", JSON.stringify(final));
  const history = await graph.models.OrderStatusHistory.find({ orderId }).lean();
  console.log("history:", history.map((x) => `${x.from}->${x.to} (${x.note ?? ""})`).join(" | "));

  const passed = final?.status === "completed";
  console.log(passed ? "E2E_RESULT=PASS" : "E2E_RESULT=FAIL");

  await Promise.all(Object.values(graph.queues).map((q) => q.close()));
  await graph.models.Category.deleteMany({});
  await graph.models.Provider.deleteMany({});
  await graph.models.Service.deleteMany({});
  await UserModel.deleteMany({});
  await graph.models.Wallet.deleteMany({});
  await graph.models.OrderStatusHistory.deleteMany({});
  await graph.models.Order.deleteMany({});

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error("E2E ERROR", err);
  process.exit(1);
});