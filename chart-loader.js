  window.__ensureChart = function(){
    if(window.__chartPromise) return window.__chartPromise;
    if(typeof Chart !== 'undefined') return Promise.resolve();
    window.__chartPromise = new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.async = true;
      s.onload = function(){ resolve(); };
      s.onerror = function(){ window.__chartPromise = null; reject(new Error('Chart.js failed to load')); };
      document.head.appendChild(s);
    });
    return window.__chartPromise;
  };
