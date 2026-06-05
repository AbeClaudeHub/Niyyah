// One-Click Reels Editor — frontend glue: upload, poll, show result.
(() => {
  const $ = (id) => document.getElementById(id);
  const fileInput = $("file");
  const drop = $("drop");
  const picked = $("picked");
  const goBtn = $("go");
  const err = $("err");

  const uploader = $("uploader");
  const progress = $("progress");
  const result = $("result");

  const stageEl = $("stage");
  const fill = $("fill");
  const pctEl = $("pct");

  const video = $("video");
  const stats = $("stats");
  const download = $("download");
  const again = $("again");

  let selectedFile = null;
  let pollTimer = null;

  const MAX_MB = 200;

  function showError(msg) {
    err.textContent = msg;
    err.classList.remove("hidden");
  }
  function clearError() {
    err.textContent = "";
    err.classList.add("hidden");
  }

  function selectFile(f) {
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i.test(f.name)) {
      showError("That doesn't look like a video file.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      showError(`File is too large (max ${MAX_MB} MB). Try a shorter clip.`);
      return;
    }
    clearError();
    selectedFile = f;
    const mb = (f.size / (1024 * 1024)).toFixed(1);
    picked.textContent = `${f.name} · ${mb} MB`;
    picked.classList.remove("hidden");
    goBtn.disabled = false;
  }

  fileInput.addEventListener("change", (e) => selectFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach((evt) =>
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
    })
  );
  drop.addEventListener("drop", (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  });

  goBtn.addEventListener("click", upload);
  again.addEventListener("click", reset);

  async function upload() {
    if (!selectedFile) return;
    clearError();
    goBtn.disabled = true;

    const fd = new FormData();
    fd.append("file", selectedFile);

    uploader.classList.add("hidden");
    progress.classList.remove("hidden");
    setProgress("Uploading…", 3);

    let res;
    try {
      res = await fetch("/api/jobs", { method: "POST", body: fd });
    } catch (e) {
      return failBackToStart("Upload failed — check your connection and try again.");
    }

    if (!res.ok) {
      let detail = "Upload failed.";
      try { detail = (await res.json()).detail || detail; } catch (_) {}
      return failBackToStart(detail);
    }

    const { job_id } = await res.json();
    poll(job_id);
  }

  function poll(jobId) {
    pollTimer = setInterval(async () => {
      let job;
      try {
        const r = await fetch(`/api/jobs/${jobId}`);
        if (!r.ok) return;
        job = await r.json();
      } catch (_) {
        return; // transient; keep polling
      }

      setProgress(job.stage || "Working…", job.progress || 0);

      if (job.status === "done") {
        clearInterval(pollTimer);
        showResult(jobId, job);
      } else if (job.status === "error") {
        clearInterval(pollTimer);
        failBackToStart(job.error || "Processing failed.");
      }
    }, 2000);
  }

  function setProgress(stage, pct) {
    stageEl.textContent = stage;
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    pctEl.textContent = `${Math.round(pct)}%`;
  }

  function showResult(jobId, job) {
    progress.classList.add("hidden");
    result.classList.remove("hidden");

    const url = `/api/jobs/${jobId}/result`;
    video.src = url;
    download.href = url;

    stats.innerHTML = "";
    const info = job.info || {};
    const chips = [];
    if (info.removed_seconds) chips.push(`✂ ${info.removed_seconds}s dead air cut`);
    if (info.word_count) chips.push(`💬 ${info.word_count} words captioned`);
    chips.push("📐 1080×1920");
    chips.push("✨ hook punch-in");
    chips.forEach((c) => {
      const s = document.createElement("span");
      s.textContent = c;
      stats.appendChild(s);
    });
  }

  function failBackToStart(msg) {
    if (pollTimer) clearInterval(pollTimer);
    progress.classList.add("hidden");
    uploader.classList.remove("hidden");
    goBtn.disabled = false;
    showError(msg);
  }

  function reset() {
    if (pollTimer) clearInterval(pollTimer);
    selectedFile = null;
    fileInput.value = "";
    picked.classList.add("hidden");
    picked.textContent = "";
    goBtn.disabled = true;
    video.removeAttribute("src");
    video.load();
    result.classList.add("hidden");
    progress.classList.add("hidden");
    uploader.classList.remove("hidden");
    clearError();
  }
})();
