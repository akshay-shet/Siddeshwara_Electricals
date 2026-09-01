"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useSyncExternalStore, useState, useCallback, useRef, useEffect } from "react";
import { type Catalog, type Entry, emptyCatalog, normalizeCatalog, sanitizeImageList } from "@/lib/catalog";

type RecoveryQuestion = {
  question: string;
  answer: string;
};

type PasswordConfig = {
  admin: {
    username: string;
    email: string;
    phone: string;
    currentPassword: string;
    recoveryQuestions: RecoveryQuestion[];
    reset?: {
      enabled?: boolean;
      allowChange?: boolean;
      message?: string;
    };
  };
};

const DEFAULT_RECOVERY_QUESTIONS: RecoveryQuestion[] = [
  { question: "What is your company start date?", answer: "bc702fbdd9ff0c01bd9274141d36da74ee602cfb24a8bffa1155c7b36da11d86" },
  { question: "What is the name of your favourite person?", answer: "7708bfc564bb08621075c973b63d3165d764ee695952c65a2a9ce409974d69a8" },
  { question: "What is your close friend name?", answer: "ab845955a39985132aa7b6b59b48b68360ee74b34e11362375cf86692740e864" },
];

const DEFAULT_SECURITY_CONFIG: PasswordConfig = {
  admin: {
    username: "Admin",
    email: "admin@siddeshwara.com",
    phone: "9876543210",
    currentPassword: "b0c64e484b2b1c26fec23e2c40ddeda7ac0b4c47f7b70466eed4fd57ac461606",
    recoveryQuestions: DEFAULT_RECOVERY_QUESTIONS,
    reset: {
      enabled: true,
      allowChange: true,
      message: "Use your username, email, phone number, and security questions to recover your password.",
    },
  },
};

const MAX_ATTEMPTS = 3;
const LOGIN_TIME_BUCKETS = [
  { maxFailures: 5, minutes: 1 },
  { maxFailures: 10, minutes: 2 },
  { maxFailures: 15, minutes: 10 },
  { maxFailures: Number.POSITIVE_INFINITY, minutes: 12 * 60 },
];

const getLoginLockoutDurationMs = (failedAttempts: number) => {
  const bucket = LOGIN_TIME_BUCKETS.find((entry) => failedAttempts <= entry.maxFailures) ?? LOGIN_TIME_BUCKETS[LOGIN_TIME_BUCKETS.length - 1];
  return bucket.minutes * 60 * 1000;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const hashSecret = async (value: string): Promise<string> => {
  const text = normalizeText(value);
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const tripleHash = async (value: string): Promise<string> => {
  let current = normalizeText(value);
  for (let index = 0; index < 3; index += 1) {
    current = await hashSecret(current);
  }
  return current;
};

const emptyEntry: Entry = { title: "", description: "", images: [] };
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("siddeshwara-catalog-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("siddeshwara-catalog-change", callback);
  };
};
const getAdminSnapshot = () => localStorage.getItem("siddeshwara-admin") === "true";
const getCatalogSnapshot = (): Catalog => {
  const stored = localStorage.getItem("siddeshwara-catalog");
  return stored ? normalizeCatalog(JSON.parse(stored)) : emptyCatalog;
};
const getServerAdminSnapshot = () => false;
const getServerCatalogSnapshot = (): Catalog => emptyCatalog;

export default function AdminPage() {
  const storedAdmin = useSyncExternalStore(subscribe, getAdminSnapshot, getServerAdminSnapshot);
  const [loggedInOverride, setLoggedInOverride] = useState<boolean | null>(null);
  const loggedIn = loggedInOverride ?? storedAdmin;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordConfig, setPasswordConfig] = useState<PasswordConfig | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [recoveryAnswers, setRecoveryAnswers] = useState<string[]>(Array(DEFAULT_RECOVERY_QUESTIONS.length).fill(""));
  const [newRecoveryAnswers, setNewRecoveryAnswers] = useState<string[]>(Array(DEFAULT_RECOVERY_QUESTIONS.length).fill(""));
  const [recoveryApproved, setRecoveryApproved] = useState(false);
  const [recoveryStartedAt, setRecoveryStartedAt] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [loginLocked, setLoginLocked] = useState(false);
  const [loginLockUntil, setLoginLockUntil] = useState<number | null>(null);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [recoveryLocked, setRecoveryLocked] = useState(false);
  const [recoveryLockUntil, setRecoveryLockUntil] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(90);

  useEffect(() => {
    const savedLoginLockUntil = Number(localStorage.getItem("siddeshwara-admin-login-lock-until") ?? "0");
    const savedRecoveryLockUntil = Number(localStorage.getItem("siddeshwara-admin-recovery-lock-until") ?? "0");

    if (savedLoginLockUntil > Date.now()) {
      setLoginLocked(true);
      setLoginLockUntil(savedLoginLockUntil);
    }

    if (savedRecoveryLockUntil > Date.now()) {
      setRecoveryLocked(true);
      setRecoveryLockUntil(savedRecoveryLockUntil);
    }
  }, []);

  useEffect(() => {
    try {
      const savedPassword = localStorage.getItem("siddeshwara-admin-password") ?? DEFAULT_SECURITY_CONFIG.admin.currentPassword;
      const savedUser = localStorage.getItem("siddeshwara-admin-username") ?? DEFAULT_SECURITY_CONFIG.admin.username;
      const savedEmail = localStorage.getItem("siddeshwara-admin-email") ?? DEFAULT_SECURITY_CONFIG.admin.email;
      const savedPhone = localStorage.getItem("siddeshwara-admin-phone") ?? DEFAULT_SECURITY_CONFIG.admin.phone;
      const savedRecovery = localStorage.getItem("siddeshwara-admin-recovery");

      const nextConfig: PasswordConfig = {
        ...DEFAULT_SECURITY_CONFIG,
        admin: {
          ...DEFAULT_SECURITY_CONFIG.admin,
          username: savedUser,
          email: savedEmail,
          phone: savedPhone,
          currentPassword: savedPassword,
          recoveryQuestions: savedRecovery ? JSON.parse(savedRecovery) : DEFAULT_SECURITY_CONFIG.admin.recoveryQuestions,
        },
      };

      setPasswordConfig(nextConfig);
    } catch {
      setPasswordConfig(DEFAULT_SECURITY_CONFIG);
      setError("Security config was not available, so the default recovery values were restored.");
    }
  }, []);

  useEffect(() => {
    if (!showPasswordReset || recoveryApproved || !recoveryStartedAt || recoveryLocked) {
      return;
    }

    const interval = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - recoveryStartedAt) / 1000);
      const remaining = Math.max(0, 90 - elapsedSeconds);
      setCountdownSeconds(remaining);

      if (remaining <= 0) {
        setError("The 90-second recovery window has ended. Please start again.");
        setRecoveryApproved(false);
        setShowPasswordReset(false);
        setRecoveryLocked(true);
        setRecoveryAttempts(MAX_ATTEMPTS);
        setRecoveryLockUntil(Date.now() + 12 * 60 * 60 * 1000);
        localStorage.setItem("siddeshwara-admin-recovery-lock-until", String(Date.now() + 12 * 60 * 60 * 1000));
        window.clearInterval(interval);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [showPasswordReset, recoveryApproved, recoveryStartedAt, recoveryLocked]);
  const [activeSection, setActiveSection] = useState<"company" | "works">("company");
  const [entry, setEntry] = useState<Entry>(emptyEntry);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const catalogCacheRef = useRef<{ raw: string | null; parsed: Catalog } | null>(null);
  
  const getCatalogSnapshotMemo = useCallback(() => {
    if (typeof window === "undefined") return emptyCatalog;
    
    if (!catalogCacheRef.current) {
      const stored = localStorage.getItem("siddeshwara-catalog");
      const parsed = stored ? normalizeCatalog(JSON.parse(stored)) : emptyCatalog;
      catalogCacheRef.current = { raw: stored, parsed };
      return parsed;
    }
    
    const stored = localStorage.getItem("siddeshwara-catalog");
    if (stored === catalogCacheRef.current.raw) {
      return catalogCacheRef.current.parsed;
    }
    
    const parsed = stored ? normalizeCatalog(JSON.parse(stored)) : emptyCatalog;
    catalogCacheRef.current = { raw: stored, parsed };
    return parsed;
  }, []);

  const getServerCatalogSnapshotMemo = useCallback(() => emptyCatalog, []);
  
  const saved = useSyncExternalStore(subscribe, getCatalogSnapshotMemo, getServerCatalogSnapshotMemo);

  const saveCatalog = useCallback(async (next: Catalog) => {
    const normalized = normalizeCatalog(next);

    if (typeof window !== "undefined") {
      localStorage.setItem("siddeshwara-catalog", JSON.stringify(normalized));
    }

    try {
      const response = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.warn(data?.message ?? "MongoDB save was not available. Local storage was updated instead.");
        return normalized;
      }

      const updated = normalizeCatalog(await response.json());
      if (typeof window !== "undefined") {
        localStorage.setItem("siddeshwara-catalog", JSON.stringify(updated));
      }
      window.dispatchEvent(new Event("siddeshwara-catalog-change"));
      return updated;
    } catch (error) {
      console.error("Unable to persist catalog to MongoDB:", error);
      window.dispatchEvent(new Event("siddeshwara-catalog-change"));
      return normalized;
    }
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();

    if (!passwordConfig?.admin) {
      setError("Password config is not ready yet. Please refresh and try again.");
      return;
    }

    if (loginLocked && loginLockUntil && loginLockUntil > Date.now()) {
      const remainingMs = loginLockUntil - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      setError(`Too many failed attempts. Please try again in ${remainingMinutes} minute(s).`);
      return;
    }

    if (loginLocked && loginLockUntil && loginLockUntil <= Date.now()) {
      setLoginLocked(false);
      setLoginLockUntil(null);
      localStorage.removeItem("siddeshwara-admin-login-lock-until");
      setLoginAttempts(0);
    }

    const effectiveUsername = localStorage.getItem("siddeshwara-admin-username") ?? passwordConfig.admin.username;
    const effectivePassword = localStorage.getItem("siddeshwara-admin-password") ?? passwordConfig.admin.currentPassword;
    const enteredPasswordHash = await tripleHash(password);

    if (normalizeText(username) === normalizeText(effectiveUsername) && enteredPasswordHash === effectivePassword) {
      localStorage.setItem("siddeshwara-admin", "true");
      setLoggedInOverride(true);
      setError("");
      setResetMessage("");
      setLoginAttempts(0);
      setLoginLocked(false);
      setLoginLockUntil(null);
      localStorage.removeItem("siddeshwara-admin-login-lock-until");
      return;
    }

    const nextLoginAttempts = loginAttempts + 1;
    setLoginAttempts(nextLoginAttempts);

    if (nextLoginAttempts >= MAX_ATTEMPTS) {
      const lockDurationMs = getLoginLockoutDurationMs(nextLoginAttempts);
      const lockUntil = Date.now() + lockDurationMs;
      setLoginLocked(true);
      setLoginLockUntil(lockUntil);
      localStorage.setItem("siddeshwara-admin-login-lock-until", String(lockUntil));
      setError(`Incorrect password. You have used all 3 attempts. Please try again after ${Math.round(lockDurationMs / 60000)} minute(s).`);
      return;
    }

    setError(`Incorrect password. ${MAX_ATTEMPTS - nextLoginAttempts} login attempt(s) remaining.`);
  };

  const handleRecoveryVerification = async (event: FormEvent) => {
    event.preventDefault();

    if (!passwordConfig?.admin) {
      setError("Password config is not ready yet.");
      return;
    }

    if (recoveryLocked && recoveryLockUntil && recoveryLockUntil > Date.now()) {
      const remainingMs = recoveryLockUntil - Date.now();
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      setError(`Too many failed recovery attempts. Please try again in ${remainingHours} hour(s).`);
      return;
    }

    if (recoveryLocked && recoveryLockUntil && recoveryLockUntil <= Date.now()) {
      setRecoveryLocked(false);
      setRecoveryLockUntil(null);
      localStorage.removeItem("siddeshwara-admin-recovery-lock-until");
      setRecoveryAttempts(0);
    }

    if (!recoveryStartedAt) {
      setRecoveryStartedAt(Date.now());
      setCountdownSeconds(90);
    }

    const elapsedSeconds = (Date.now() - (recoveryStartedAt ?? Date.now())) / 1000;
    if (elapsedSeconds > 90) {
      setError("The 90-second verification window has ended. Please start again.");
      setRecoveryApproved(false);
      setRecoveryLocked(true);
      setRecoveryAttempts(MAX_ATTEMPTS);
      const lockUntil = Date.now() + 12 * 60 * 60 * 1000;
      setRecoveryLockUntil(lockUntil);
      localStorage.setItem("siddeshwara-admin-recovery-lock-until", String(lockUntil));
      return;
    }

    const matchesUsername = normalizeText(recoveryUsername) === normalizeText(passwordConfig.admin.username);
    const matchesEmail = normalizeText(recoveryEmail) === normalizeText(passwordConfig.admin.email);
    const matchesPhone = normalizeText(recoveryPhone) === normalizeText(passwordConfig.admin.phone);

    if (!matchesUsername || !matchesEmail || !matchesPhone) {
      const nextRecoveryAttempts = recoveryAttempts + 1;
      setRecoveryAttempts(nextRecoveryAttempts);
      if (nextRecoveryAttempts >= MAX_ATTEMPTS) {
        const lockUntil = Date.now() + 12 * 60 * 60 * 1000;
        setRecoveryLocked(true);
        setRecoveryLockUntil(lockUntil);
        localStorage.setItem("siddeshwara-admin-recovery-lock-until", String(lockUntil));
        setError("Recovery details do not match. You have used all 3 attempts. Please try again after 12 hours.");
        return;
      }
      setError(`Recovery details do not match. ${MAX_ATTEMPTS - nextRecoveryAttempts} attempt(s) remaining.`);
      return;
    }

    const allAnswersMatch = await Promise.all(
      DEFAULT_RECOVERY_QUESTIONS.map(async ({ answer }, index) => {
        const entered = recoveryAnswers[index] ?? "";
        return (await tripleHash(entered)) === answer;
      }),
    );

    if (!allAnswersMatch.every(Boolean)) {
      const nextRecoveryAttempts = recoveryAttempts + 1;
      setRecoveryAttempts(nextRecoveryAttempts);
      if (nextRecoveryAttempts >= MAX_ATTEMPTS) {
        const lockUntil = Date.now() + 12 * 60 * 60 * 1000;
        setRecoveryLocked(true);
        setRecoveryLockUntil(lockUntil);
        localStorage.setItem("siddeshwara-admin-recovery-lock-until", String(lockUntil));
        setError("One or more recovery answers are incorrect. You have used all 3 attempts. Please try again after 12 hours.");
        return;
      }
      setError(`One or more recovery answers are incorrect. ${MAX_ATTEMPTS - nextRecoveryAttempts} attempt(s) remaining.`);
      return;
    }

    setRecoveryApproved(true);
    setShowPasswordReset(true);
    setError("");
    setResetMessage("Recovery approved. You can now reset the password.");
  };

  const handlePasswordReset = async (event: FormEvent) => {
    event.preventDefault();

    if (!passwordConfig?.admin) {
      setError("Password config is not ready yet.");
      return;
    }

    if (!recoveryApproved) {
      setError("Please verify your recovery details first.");
      return;
    }

    if (!newPassword.trim() || newPassword.length < 4) {
      setError("New password must be at least 4 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    if (newRecoveryAnswers.some((answer) => !answer.trim())) {
      setError("All 3 security answers must be filled in before saving the new recovery details.");
      return;
    }

    const hashedPassword = await tripleHash(newPassword);
    const hashedRecoveryAnswers = await Promise.all(
      newRecoveryAnswers.map(async (answer) => tripleHash(answer)),
    );

    const nextConfig: PasswordConfig = {
      ...passwordConfig,
      admin: {
        ...passwordConfig.admin,
        username: recoveryUsername || passwordConfig.admin.username,
        email: recoveryEmail || passwordConfig.admin.email,
        phone: recoveryPhone || passwordConfig.admin.phone,
        currentPassword: hashedPassword,
        recoveryQuestions: DEFAULT_RECOVERY_QUESTIONS.map((question, index) => ({
          ...question,
          answer: hashedRecoveryAnswers[index] ?? question.answer,
        })),
      },
    };

    localStorage.setItem("siddeshwara-admin-password", hashedPassword);
    localStorage.setItem("siddeshwara-admin-username", recoveryUsername || passwordConfig.admin.username);
    localStorage.setItem("siddeshwara-admin-email", recoveryEmail || passwordConfig.admin.email);
    localStorage.setItem("siddeshwara-admin-phone", recoveryPhone || passwordConfig.admin.phone);
    localStorage.setItem("siddeshwara-admin-recovery", JSON.stringify(nextConfig.admin.recoveryQuestions));

    setPasswordConfig(nextConfig);
    setPassword(newPassword);
    setNewPassword("");
    setConfirmPassword("");
    setNewRecoveryAnswers(Array(DEFAULT_RECOVERY_QUESTIONS.length).fill(""));
    setRecoveryAnswers(Array(DEFAULT_RECOVERY_QUESTIONS.length).fill(""));
    setRecoveryApproved(false);
    setShowPasswordReset(false);
    setRecoveryStartedAt(null);
    setResetMessage("Password and all 3 recovery answers were updated successfully and saved with triple hashing.");
    setError("");
  };

  const readFilesAsDataUrls = async (files: FileList | null) => {
    if (!files || files.length === 0) return [];

    const fileReaders = Array.from(files).map(async (file) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsDataURL(file);
      });

      if (!dataUrl.startsWith("data:image/")) {
        return dataUrl;
      }

      return await new Promise<string>((resolve) => {
        const image = new window.Image();
        image.onload = () => {
          const maxWidth = 1600;
          const maxHeight = 1200;
          const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");

          if (!context) {
            resolve(dataUrl);
            return;
          }

          context.drawImage(image, 0, 0, width, height);
          const quality = file.size > 1_500_000 ? 0.7 : 0.85;
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.onerror = () => resolve(dataUrl);
        image.src = dataUrl;
      });
    });

    const images = await Promise.all(fileReaders);
    return sanitizeImageList(images);
  };

  const addEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!entry.title.trim()) return;

    let next: Catalog;
    if (editingIndex !== null) {
      const updated = [...saved[activeSection]];
      updated[editingIndex] = entry;
      next = { ...saved, [activeSection]: updated };
      setEditingIndex(null);
    } else {
      next = { ...saved, [activeSection]: [...saved[activeSection], entry] };
    }

    await saveCatalog(next);
    setEntry(emptyEntry);
  };

  const deleteEntry = async (index: number) => {
    const updated = saved[activeSection].filter((_: Entry, i: number) => i !== index);
    const next = { ...saved, [activeSection]: updated };
    await saveCatalog(next);
  };

  const editEntry = (index: number) => {
    setEntry(saved[activeSection][index]);
    setEditingIndex(index);
  };

  const cancelEdit = () => {
    setEntry(emptyEntry);
    setEditingIndex(null);
  };

  if (!loggedIn) return <main className="admin-page"><div className="admin-login"><Link href="/" className="admin-back">← Back to website</Link><div className="brand"><Image className="logo-image" src="/logo.png" alt="Siddeshwara Electricals logo" width={72} height={48} priority /><span className="brand-name">Siddeshwara<br /><em>Electricals</em></span></div><p className="admin-label">PRIVATE WORKSPACE</p><h1>Welcome<br /><i>back.</i></h1><form onSubmit={login}><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="admin-error">{error}</p>}{resetMessage && <p className="admin-success">{resetMessage}</p>}<button type="submit">Enter dashboard <span>↗</span></button><button type="button" className="text-button" onClick={() => { setShowPasswordReset((current) => !current); setRecoveryApproved(false); setRecoveryStartedAt(Date.now()); setCountdownSeconds(90); setRecoveryAttempts(0); setRecoveryLocked(false); setError(""); setResetMessage(""); }}>Forgot password?</button>{showPasswordReset && <div className="password-reset"><p className="admin-label">RECOVERY CHECK</p><label>Username<input value={recoveryUsername} onChange={(event) => setRecoveryUsername(event.target.value)} /></label><label>Email<input type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} /></label><label>Phone number<input value={recoveryPhone} onChange={(event) => setRecoveryPhone(event.target.value)} /></label>{DEFAULT_RECOVERY_QUESTIONS.map((item, index) => (<label key={item.question}>{item.question}<input value={recoveryAnswers[index] ?? ""} onChange={(event) => {
              const next = [...recoveryAnswers];
              next[index] = event.target.value;
              setRecoveryAnswers(next);
            }} /></label>))}<p className="field-note">Time remaining: {countdownSeconds}s. Complete all 3 questions within 90 seconds to unlock password reset.</p><button type="button" onClick={handleRecoveryVerification}>Verify recovery details</button>{recoveryApproved && <div className="password-reset"><label>Username<input value={recoveryUsername} onChange={(event) => setRecoveryUsername(event.target.value)} /></label><label>Email<input type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} /></label><label>Phone number<input value={recoveryPhone} onChange={(event) => setRecoveryPhone(event.target.value)} /></label><label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{DEFAULT_RECOVERY_QUESTIONS.map((item, index) => (<label key={item.question + "-new"}>{item.question}<input value={newRecoveryAnswers[index] ?? ""} onChange={(event) => {
                    const next = [...newRecoveryAnswers];
                    next[index] = event.target.value;
                    setNewRecoveryAnswers(next);
                  }} /></label>))}<button type="button" onClick={handlePasswordReset}>Save new password and answers</button></div>}</div>}</form></div></main>;

  return <main className="admin-page"><header className="admin-header"><Link href="/" className="brand"><Image className="logo-image" src="/logo.png" alt="Siddeshwara Electricals logo" width={72} height={48} priority /><span className="brand-name">Siddeshwara<br /><em>Electricals</em></span></Link><div><span className="admin-status">● Local workspace</span><button className="logout" onClick={() => { localStorage.removeItem("siddeshwara-admin"); setLoggedInOverride(false); }}>Log out</button></div></header><div className="admin-layout"><aside><p className="admin-label">CONTENT MANAGER</p><h2>Dashboard</h2><button className={activeSection === "company" ? "side-active" : ""} onClick={() => { setActiveSection("company"); setEntry(emptyEntry); setEditingIndex(null); }}>01 <span>Company related</span></button><button className={activeSection === "works" ? "side-active" : ""} onClick={() => { setActiveSection("works"); setEntry(emptyEntry); setEditingIndex(null); }}>02 <span>Work related</span></button><Link href="/">View live site ↗</Link></aside><section className="admin-content"><div className="admin-title"><div><p className="admin-label">{editingIndex !== null ? "EDIT ENTRY" : "ADD NEW ENTRY"}</p><h1>{activeSection === "company" ? "Company related" : "Work related"}</h1></div><span className="entry-count">{saved[activeSection].length.toString().padStart(2, "0")} published</span></div><form className="entry-form" onSubmit={addEntry}><label>Title<input required value={entry.title} onChange={(event) => setEntry({ ...entry, title: event.target.value })} placeholder={activeSection === "company" ? "Our approach to critical power" : "Project or installation name"} /></label><label>Description<textarea value={entry.description} onChange={(event) => setEntry({ ...entry, description: event.target.value })} placeholder="Add the context visitors should know..." /></label><label>Images <span className="field-note">Select as many as needed</span><input type="file" accept="image/*" multiple onChange={async (event) => { const nextImages = await readFilesAsDataUrls(event.target.files); setEntry({ ...entry, images: nextImages }); }} /></label>{entry.images.length > 0 && <p className="file-list">{entry.images.length} image{entry.images.length > 1 ? "s" : ""} selected</p>}<button className="save-entry" type="submit">{editingIndex !== null ? "Update" : "Publish"} {activeSection === "company" ? "company" : "work"} entry <span>↗</span></button>{editingIndex !== null && <button type="button" className="cancel-edit" onClick={cancelEdit}>Cancel</button>}</form><div className="saved-list"><p className="admin-label">PUBLISHED ENTRIES</p>{saved[activeSection].length === 0 ? <p className="empty-state">No entries yet. Add the first one above.</p> : saved[activeSection].map((item: Entry, index: number) => <article key={`${item.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{item.description || "No description added."}</p><small>{item.images.length} image{item.images.length > 1 ? "s" : ""}</small></div><div className="entry-actions"><button type="button" className="edit-btn" onClick={() => editEntry(index)}>Edit</button><button type="button" className="delete-btn" onClick={() => deleteEntry(index)}>Delete</button></div></article>)}</div></section></div></main>;
}
