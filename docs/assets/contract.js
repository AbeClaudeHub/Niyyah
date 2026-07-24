/* Niyyah — contract signing + offer reveal. Shared by all contract-*.html pages. */

// TODO before launch: paste your Whop checkout link here, e.g. "https://whop.com/checkout/xxxxxxxx"
const WHOP_LINK = "";

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("sigName");
  const checkbox = document.getElementById("sigAck");
  const signBtn = document.getElementById("signBtn");
  const sigBlock = document.getElementById("sigBlock");
  const offer = document.getElementById("offer");
  const offerBtn = document.getElementById("offerBtn");
  const archetype = document.body.dataset.archetype || "";

  function checkReady(){
    signBtn.disabled = !(nameInput.value.trim().length > 1 && checkbox.checked);
  }
  nameInput.addEventListener("input", checkReady);
  checkbox.addEventListener("change", checkReady);

  signBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    try{
      localStorage.setItem("niyyah_signed", JSON.stringify({ name, archetype, ts: new Date().toISOString() }));
    }catch(_){}
    sigBlock.classList.add("fx-out");
    setTimeout(() => {
      sigBlock.style.display = "none";
      offer.hidden = false;
      offer.classList.add("fx-in");
      offer.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 280);
  });

  if(WHOP_LINK){
    offerBtn.href = WHOP_LINK;
  }else{
    offerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Checkout isn't connected yet — add your Whop link in assets/contract.js.");
    });
  }
});
