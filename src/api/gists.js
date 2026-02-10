import axios from "axios";

export const SHARE_FILENAME = "share.json";
export const VERSION_FILENAME = "versionned.json";

const description = "drawDB diagram";
const baseUrl = import.meta.env.VITE_BACKEND_URL;

function ensureBackendUrl() {
  if (!baseUrl) {
    throw new Error("Backend URL not configured");
  }
}

export async function create(filename, content) {
  ensureBackendUrl();
  const res = await axios.post(`${baseUrl}/gists`, {
    public: false,
    filename,
    description,
    content,
  });

  return res.data.data.id;
}

export async function patch(gistId, filename, content) {
  ensureBackendUrl();
  const { data } = await axios.patch(`${baseUrl}/gists/${gistId}`, {
    filename,
    content,
  });

  return data.deleted;
}

export async function del(gistId) {
  ensureBackendUrl();
  await axios.delete(`${baseUrl}/gists/${gistId}`);
}

export async function get(gistId) {
  ensureBackendUrl();
  const res = await axios.get(`${baseUrl}/gists/${gistId}`);

  return res.data;
}

export async function getCommits(gistId, perPage = 20, page = 1) {
  ensureBackendUrl();
  const res = await axios.get(`${baseUrl}/gists/${gistId}/commits`, {
    params: {
      per_page: perPage,
      page,
    },
  });

  return res.data;
}

export async function getVersion(gistId, sha) {
  ensureBackendUrl();
  const res = await axios.get(`${baseUrl}/gists/${gistId}/${sha}`);

  return res.data;
}

export async function getCommitsWithFile(
  gistId,
  file,
  limit = 10,
  cursor = null,
) {
  ensureBackendUrl();
  const res = await axios.get(
    `${baseUrl}/gists/${gistId}/file-versions/${file}`,
    {
      params: {
        limit,
        cursor,
      },
    },
  );

  return res.data;
}

export async function compare(gistId, file, versionA, versionB) {
  ensureBackendUrl();
  const res = await axios.get(
    `${baseUrl}/gists/${gistId}/file/${file}/compare/${versionA}/${versionB}`,
  );

  return res.data;
}
