// Lists the Circle developer-controlled wallets visible to an API key (addresses and chains only).
//   node scripts/circle-wallets.mjs <env-file> <API_KEY_VAR>
import { readFileSync } from "node:fs";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const [envFile, keyVar = "CIRCLE_API_KEY"] = process.argv.slice(2);
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
const apiKey = env[keyVar];
console.log("key type:", apiKey?.split(":")[0]);
const circle = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret: env.CIRCLE_ENTITY_SECRET });
const res = await circle.listWallets({ pageSize: 50 });
for (const w of res.data?.wallets ?? []) console.log(w.blockchain, w.address, w.id, w.accountType, w.state);
