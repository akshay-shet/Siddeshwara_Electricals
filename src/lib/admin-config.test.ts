import test from "node:test";
import assert from "node:assert/strict";

import { resolveAdminCredentials, FORCE_DEFAULT_ADMIN_FOR_DEPLOYMENT, DEFAULT_DEPLOYMENT_ADMIN } from "./admin-config";

test("deployment mode ignores stale browser overrides and keeps default admin values", () => {
  const storage = {
    getItem: (key: string) => {
      if (key === "siddeshwara-admin-username") return "SomeOtherUser";
      if (key === "siddeshwara-admin-password") return "not-the-real-hash";
      return null;
    },
    removeItem: () => undefined,
  } as Storage;

  const resolved = resolveAdminCredentials(storage);

  assert.equal(FORCE_DEFAULT_ADMIN_FOR_DEPLOYMENT, true);
  assert.equal(resolved.username, DEFAULT_DEPLOYMENT_ADMIN.username);
  assert.equal(resolved.currentPassword, DEFAULT_DEPLOYMENT_ADMIN.currentPassword);
});
