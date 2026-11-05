// Server-only re-export so route files never import a non-.server module from src/server.
export { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";
