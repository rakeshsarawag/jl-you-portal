import { projectId } from "../../utils/supabase/info";

// ── API ──────────────────────────────────────────────────────────────────────
export const FUNCTION_NAME = "make-server-1fe2c468";
export const API_BASE = `https://${projectId}.supabase.co/functions/v1/${FUNCTION_NAME}`;
export const SERVER_PREFIX = "make-server-4c07aff1";

// ── Pagination ───────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ── Date / Time ───────────────────────────────────────────────────────────────
export const DATE_FORMAT = "DD MMM YYYY";
export const DATETIME_FORMAT = "DD MMM YYYY HH:mm";
export const TIME_FORMAT = "HH:mm";

// ── File uploads ──────────────────────────────────────────────────────────────
export const MAX_UPLOAD_SIZE_MB = 10;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_DOC_TYPES = ["application/pdf", "application/msword"];
export const ALLOWED_CSV_TYPES = ["text/csv", "application/vnd.ms-excel"];

// ── Toast / notification durations (ms) ──────────────────────────────────────
export const TOAST_SUCCESS_DURATION = 3000;
export const TOAST_ERROR_DURATION = 5000;

// ── Session ───────────────────────────────────────────────────────────────────
export const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

// ── App version ───────────────────────────────────────────────────────────────
export const APP_VERSION = "2026-08-24";
export const APP_NAME = "JL You Portal";
