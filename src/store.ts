import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

export type Binding = {
  discordUserId: string;
  discordUsername: string;
  covafluxUserId: string;
  covafluxUsername: string;
  encryptedCovafluxJwt: string;
  createdByAdminDiscordUserId?: string;
  createdAt: string;
  updatedAt: string;
};

type StoreData = {
  bindings: Binding[];
};

const storePath = path.join(config.dataDir, "bindings.json");

async function readData(): Promise<StoreData> {
  try {
    return JSON.parse(await readFile(storePath, "utf8")) as StoreData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { bindings: [] };
    throw error;
  }
}

async function writeData(data: StoreData) {
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function findBindingByDiscordUserId(discordUserId: string) {
  const data = await readData();
  return data.bindings.find((binding) => binding.discordUserId === discordUserId) ?? null;
}

export async function findBindingByCovafluxUserId(covafluxUserId: string) {
  const data = await readData();
  return data.bindings.find((binding) => binding.covafluxUserId === covafluxUserId) ?? null;
}

export async function upsertBinding(input: {
  discordUserId: string;
  discordUsername: string;
  covafluxUserId: string;
  covafluxUsername: string;
  covafluxJwt: string;
  createdByAdminDiscordUserId?: string;
}) {
  const data = await readData();
  const now = new Date().toISOString();
  const encryptedCovafluxJwt = encryptSecret(input.covafluxJwt);
  const existingIndex = data.bindings.findIndex((binding) => binding.discordUserId === input.discordUserId);
  const taken = data.bindings.find(
    (binding) => binding.covafluxUserId === input.covafluxUserId && binding.discordUserId !== input.discordUserId
  );
  if (taken) {
    throw new Error(`CovaFlux user ${input.covafluxUsername} is already bound to another Discord account`);
  }

  const next: Binding = {
    discordUserId: input.discordUserId,
    discordUsername: input.discordUsername,
    covafluxUserId: input.covafluxUserId,
    covafluxUsername: input.covafluxUsername,
    encryptedCovafluxJwt,
    createdByAdminDiscordUserId: input.createdByAdminDiscordUserId,
    createdAt: existingIndex >= 0 ? data.bindings[existingIndex].createdAt : now,
    updatedAt: now
  };

  if (existingIndex >= 0) data.bindings[existingIndex] = next;
  else data.bindings.push(next);
  await writeData(data);
  return next;
}

export function getBindingJwt(binding: Binding) {
  return decryptSecret(binding.encryptedCovafluxJwt);
}
