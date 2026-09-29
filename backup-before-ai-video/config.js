const runtimeConfig = window.__APP_CONFIG__ || {};

export const API_BASE_URL =
  runtimeConfig.API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:5000";

export const APP_ENV = runtimeConfig.APP_ENV || process.env.REACT_APP_ENV || "development";
