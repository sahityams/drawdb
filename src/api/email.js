import axios from "axios";

export async function send(subject, message, attachments) {
  if (!import.meta.env.VITE_BACKEND_URL) {
    throw new Error("Backend URL not configured");
  }
  return await axios.post(`${import.meta.env.VITE_BACKEND_URL}/email/send`, {
    subject,
    message,
    attachments,
  });
}
