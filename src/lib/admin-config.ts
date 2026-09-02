export type AdminCredentials = {
  username: string;
  currentPassword: string;
  email: string;
  phone: string;
};

export const DEFAULT_DEPLOYMENT_ADMIN: AdminCredentials = {
  username: "Admin",
  currentPassword: "b0c64e484b2b1c26fec23e2c40ddeda7ac0b4c47f7b70466eed4fd57ac461606",
  email: "admin@siddeshwara.com",
  phone: "9876543210",
};

export const FORCE_DEFAULT_ADMIN_FOR_DEPLOYMENT = false;

export function resolveAdminCredentials(storage: Pick<Storage, "getItem" | "removeItem">): AdminCredentials {
  const savedUsername = storage.getItem("siddeshwara-admin-username");
  const savedPassword = storage.getItem("siddeshwara-admin-password");
  const savedEmail = storage.getItem("siddeshwara-admin-email");
  const savedPhone = storage.getItem("siddeshwara-admin-phone");

  const hasCustomAdminValues = Boolean(savedUsername || savedPassword || savedEmail || savedPhone);

  if (!hasCustomAdminValues) {
    return DEFAULT_DEPLOYMENT_ADMIN;
  }

  return {
    username: savedUsername ?? DEFAULT_DEPLOYMENT_ADMIN.username,
    currentPassword: savedPassword ?? DEFAULT_DEPLOYMENT_ADMIN.currentPassword,
    email: savedEmail ?? DEFAULT_DEPLOYMENT_ADMIN.email,
    phone: savedPhone ?? DEFAULT_DEPLOYMENT_ADMIN.phone,
  };
}
