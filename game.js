(() => {
  'use strict';
  const E = window.SokobanEngine, levels = window.SokobanLevels;
  const $ = id => document.getElementById(id), canvas = $('board'), ctx = canvas.getContext('2d');
  const key = 'sokoban_progress_v2', cookieKey = 'sokoban_completed_v2';
  let records = {}, index = 0, state, holding = null, swipe = null, storageFailed = false;
  let celebrating = false;
  const victory = window.SokobanCelebration;
  function cancelVictory() { celebrating = false; victory.cancel(); }
  const validIndex = n => Number.isInteger(n) && n >= 0 && n < levels.length;
  const track = (name, data = {}) => { if (typeof window.gtag === 'function') window.gtag('event', name, {game_name: 'sokoban', level_number: index, ...data}); };
  function mergeRecord(n, r) {
    if (!validIndex(n) || !r || !Number.isSafeInteger(r.moves) || !Number.isSafeInteger(r.pushes) || r.moves < r.pushes || r.pushes <= 0) return;
    const old = records[n];
    if (!old || r.moves < old.moves || (r.moves === old.moves && r.pushes < old.pushes)) records[n] = {moves: r.moves, pushes: r.pushes};
  }
  function cookieValue() {
    return document.cookie.split('; ').find(part => part.startsWith(cookieKey + '='))?.slice(cookieKey.length + 1);
  }
  function save() {
    let localSaved = false, cookieSaved = false;
    try {
      localStorage.setItem(key, JSON.stringify({version: 2, index, records, path: state.history.map(step => step.direction)}));
      localSaved = true;
    } catch {}
    try {
      // Compact base-36 records stay below cookie limits even with all 51 levels solved.
      const value = index.toString(36) + '|' + Object.entries(records).map(([n, r]) => [Number(n), r.moves, r.pushes].map(v => v.toString(36)).join('.')).join(',');
      document.cookie = `${cookieKey}=${value}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      cookieSaved = cookieValue() === value;
    } catch {}
    storageFailed = !localSaved && !cookieSaved;
    $('storage-warning').hidden = localSaved && cookieSaved;
    $('storage-warning').textContent = storageFailed ? 'Saving is unavailable. Progress lasts until you leave.' : !localSaved ? 'Completed levels are saved in a cookie. Your current position cannot be saved in this browser.' : 'Cookies are unavailable. Your progress is saved in browser storage on this device.';
  }
  function restore() {
    let data;
    try {
      const raw = localStorage.getItem(key) || localStorage.getItem('sokoban_progress_v1');
      const parsed = raw && JSON.parse(raw);
      if (parsed && [1, 2].includes(parsed.version)) {
        const offset = parsed.version === 1 ? 1 : 0;
        if (validIndex(parsed.index + offset)) {
          data = parsed; index = parsed.index + offset;
          for (const [n, r] of Object.entries(parsed.records || {})) mergeRecord(Number(n) + offset, r);
        }
      }
    } catch {}
    try {
      const value = cookieValue();
      if (value) {
        const [current, saved] = value.split('|');
        if (!data && validIndex(parseInt(current, 36))) index = parseInt(current, 36);
        for (const entry of (saved || '').split(',')) {
          const [n, moves, pushes] = entry.split('.').map(v => parseInt(v, 36));
          mergeRecord(n, {moves, pushes});
        }
      }
    } catch {}
    state = E.create(levels[index]);
    if (Array.isArray(data?.path) && data.path.length <= 100000) {
      for (const direction of data.path) {
        if (!Object.hasOwn(E.directions, direction) || !E.move(state, direction)) { state = E.create(levels[index]); break; }
      }
    }
    // Also recover completion if an earlier save was interrupted just after the last push.
    if (E.won(state)) mergeRecord(index, state);
    save();
  }
  function stopHold() { if (holding) { clearTimeout(holding.delay); clearInterval(holding.repeat); holding = null; } }
  function openDialog(id) { cancelVictory(); stopHold(); swipe = null; $(id).showModal(); }
  function closeDialog(dialog) { dialog.close(); canvas.focus({preventScroll:true}); }
  function load(n) {
    cancelVictory(); stopHold(); index = n; state = E.create(levels[index]);
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    save(); render(); canvas.focus({preventScroll:true}); track('level_start');
  }
  function updateStats() {
    $('level').textContent = String(index).padStart(2, '0');
    $('moves').textContent = state.moves; $('pushes').textContent = state.pushes;
    const placed = [...state.boxes].filter(p => state.goals.has(p)).length;
    $('targets').textContent = `${placed} / ${state.boxes.size}`;
    $('undo').disabled = !state.history.length; $('redo').disabled = !state.future.length;
    const best = records[index];
    $('best').textContent = best ? `BEST: ${best.moves} MOVES / ${best.pushes} PUSHES` : 'NO RECORD YET';
    $('status').textContent = E.won(state) ? 'All crates in place! Choose a level to keep playing.' : E.cornered(state) ? 'A crate is stuck in a corner. Undo to try another way.' : index === 0 ? 'A gentle start: push each crate up onto its diamond.' : 'Push every crate onto a diamond.';
    canvas.setAttribute('aria-label', `Sokoban level ${index}. ${placed} of ${state.boxes.size} crates on targets. ${state.moves} moves. Use arrows to move, Z to undo.`);
  }
  function finish() {
    const old = records[index], improved = !old || state.moves < old.moves || (state.moves === old.moves && state.pushes < old.pushes);
    if (improved) records[index] = {moves: state.moves, pushes: state.pushes};
    save(); updateStats();
    $('win-summary').textContent = `Level ${index} completed in ${state.moves} moves and ${state.pushes} pushes.`;
    $('win-record').textContent = Object.keys(records).length === levels.length ? 'All 51 warehouses complete. Beautiful work.' : improved ? 'Your best solution for this level so far. Saved on this device.' : `Your best: ${old.moves} moves and ${old.pushes} pushes.`;
    if (storageFailed) $('win-record').textContent = 'Level complete! Your browser could not save this result.';
    $('next').textContent = index === levels.length - 1 ? 'Choose a level →' : 'Next level →';
    track('level_end', {success: true, moves: state.moves, pushes: state.pushes});
    stopHold(); swipe = null; celebrating = true;
    victory.play({board: canvas, width: state.width, height: state.height,
      lastBox: state.history.at(-1)?.box ?? state.player, goals: [...state.goals],
      onComplete: () => openDialog('win-dialog')});
  }
  function step(direction) {
    if (celebrating || document.querySelector('dialog[open]')) return;
    const moved = E.move(state, direction); render();
    if (moved) { save(); if (E.won(state)) finish(); }
  }
  function undo() { cancelVictory(); if (E.undo(state)) {save(); render();} }
  function redo() { cancelVictory(); if (E.redo(state)) {save(); render(); if (E.won(state)) finish();} }
  function askRestart() { if (state.moves) openDialog('restart-dialog'); }
  // All tiles are drawn locally at a 32-pixel base resolution.
  function rect(x,y,w,h,color) { ctx.fillStyle=color; ctx.fillRect(x,y,w,h); }
  function tile(x,y,p) {
    ctx.save(); ctx.translate(x*32,y*32);
    if (state.walls.has(p)) {
      rect(0,0,32,32,'#482f26');
      for(let row=0;row<4;row++) {
        const shift=row%2 ? -8 : 0;
        for(let bx=shift;bx<32;bx+=16) {
          const left=Math.max(0,bx),right=Math.min(32,bx+15);
          rect(left,row*8,right-left,7,(x+y+row)%3===0?'#a87952':'#926343');
          rect(left,row*8,right-left,1,'#ba8a5c');
          rect(left,row*8+6,right-left,1,'#684731');
        }
      }
      rect(0,30,32,2,'#362e25');
    } else if(state.floor.has(p)) {
      rect(0,0,32,32,'#394a46'); rect(0,0,32,1,'#4a5b54'); rect(0,0,1,32,'#44564f');
      rect(31,0,1,32,'#283b38');rect(0,31,32,1,'#2b3c38');
      rect(5+(x*7+y*3)%20,6+(x*3+y*7)%20,2,1,'#536159');
      if(state.goals.has(p)) {
        ctx.strokeStyle='#e1c787';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(16,8);ctx.lineTo(24,16);ctx.lineTo(16,24);ctx.lineTo(8,16);ctx.closePath();ctx.stroke();rect(14,14,4,4,'#d8bc7a');
      }
    }
    if(state.boxes.has(p)) {
      const done=state.goals.has(p);
      rect(3,5,28,27,'#162923');rect(2,2,27,27,done?'#355d43':'#614329');
      rect(4,4,23,23,done?'#80aa76':'#c79654');
      for(let line=0;line<3;line++){rect(5,7+line*7,21,1,done?'#5e8d60':'#ac7a42');rect(8+line*7,5,1,21,done?'#9bbb82':'#d7ab68');}
      for(let k=0;k<21;k++){rect(5+k,5+k,3,3,done?'#466c4b':'#79502e');rect(24-k,5+k,3,3,done?'#466c4b':'#79502e');}
      rect(3,3,25,2,done?'#bbcf95':'#eed096');rect(3,3,2,25,done?'#a5c28b':'#e0b477');
      rect(5,25,22,2,done?'#668655':'#a2743d');
      [[5,5],[24,5],[5,24],[24,24]].forEach(([a,b])=>rect(a,b,2,2,'#394338'));
      if(done){rect(12,12,8,8,'#315642');ctx.strokeStyle='#dce8ba';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(13,16);ctx.lineTo(15,18);ctx.lineTo(19,13);ctx.stroke();}
    }
    if(state.player===p) drawKeeper();
    ctx.restore();
  }
  function drawKeeper() {
    const facing = state.facing, side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
    const back = facing === 'up', stride = state.moves % 2 ? .6 : -.6;
    const oval = (x, y, rx, ry, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    };
    const limb = (x, y, ex, ey, width, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    };
    oval(16, 28.5, 9, 2.4, '#10221d88');
    limb(13, 21, 12.6 - side, 27 + stride, 4.1, '#293e50');
    limb(19, 21, 19.4 - side, 27 - stride, 4.1, '#38556a');
    oval(12.8 + side, 28 + stride, 3.2, 1.6, '#172024');
    oval(19.6 + side, 28 - stride, 3.2, 1.6, '#172024');
    limb(10.7, 13.5, 8.6 + side * 2, 18, 4, '#557f89');
    limb(21.3, 13.5, 23.4 + side * 2, 18, 4, '#3a6372');
    limb(8.6 + side * 2, 18, 9.2 + side * 3, 21, 2.8, '#c38d69');
    limb(23.4 + side * 2, 18, 22.8 + side * 3, 21, 2.8, '#e1ad82');
    const shirt = ctx.createLinearGradient(10, 0, 22, 0);
    shirt.addColorStop(0, '#355a68'); shirt.addColorStop(.45, '#729da1'); shirt.addColorStop(1, '#365f70');
    ctx.fillStyle = shirt; ctx.beginPath(); ctx.moveTo(12, 11.5); ctx.quadraticCurveTo(16, 10, 20, 11.5);
    ctx.lineTo(22, 15); ctx.lineTo(21, 22.5); ctx.quadraticCurveTo(16, 24, 11, 22.5); ctx.lineTo(10, 15); ctx.closePath(); ctx.fill();
    limb(11.8, 22.4, 20.2, 22.4, 1.3, '#44392b');
    if (!back) {
      limb(16, 13, 16, 21, .6, '#b4c6b9');
      rect(18, 14.3, 2.2, 2.3, '#345867'); rect(15.2, 21.8, 1.6, 1.3, '#c3b389');
    }
    limb(16, 10.5, 16, 12, 3.2, '#bc8665');
    oval(16 + side * .6, 7.7, 4.1, 4.8, '#bd8767');
    oval(16.4 + side, 7.5, 3.5, 4.2, '#e0b08a');
    oval(12.3, 8, .8, 1.3, '#c99470'); oval(19.7, 8, .8, 1.3, '#c99470');
    if (back) oval(16, 7, 4, 3.9, '#504135');
    else {
      oval(16 + side * 2.8, 9, .8, 1, '#bc8665');
      for (const x of side ? [16 + side * 2.3] : [14.5, 18]) oval(x, 7.6, .48, .55, '#28322d');
      limb(15.1 + side * 1.7, 10.4, 17 + side * 1.7, 10.4, .5, '#81533f');
    }
    const helmet = ctx.createLinearGradient(12, 2, 19, 7);
    helmet.addColorStop(0, '#ffe3a1'); helmet.addColorStop(.5, '#d7b568'); helmet.addColorStop(1, '#947139');
    oval(16, 4.6, 4.7, 3.3, helmet);
    oval(16 + side * 1.2, 6, 5.5, 1.1, '#e8c77e');
    limb(16, 2, 16, 4.5, .8, '#fff0be');
  }
  function draw() {
    const wrap = canvas.parentElement, mobile=window.innerWidth<=650;
    const available = wrap.clientWidth - (mobile ? 16 : 44);
    const tileSize = Math.min(42,Math.floor(available/state.width),Math.max(16,Math.floor((window.innerHeight*(mobile?.43:.51))/state.height)));
    const scale = tileSize * Math.min(window.devicePixelRatio || 1, 3) / 32;
    canvas.width=Math.round(state.width*32*scale); canvas.height=Math.round(state.height*32*scale);
    ctx.setTransform(scale,0,0,scale,0,0);
    canvas.style.width=`${state.width*tileSize}px`;canvas.style.height=`${state.height*tileSize}px`;
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<state.height;y++) for(let x=0;x<state.width;x++) tile(x,y,y*state.width+x);
  }
  function render() { updateStats(); draw(); }
  function showLevels() {
    $('completed-count').textContent=Object.keys(records).length;
    $('level-grid').replaceChildren(...levels.map((_, n) => {
      const button=document.createElement('button');button.textContent=String(n).padStart(2,'0');
      button.className=[n===index?'current':'',records[n]?'solved':''].join(' ');
      button.setAttribute('aria-label',`Level ${n}${n === 0 ? ', easy introduction' : ''}${records[n]?', completed':''}${n===index?', current':''}`);
      if(n===index) button.setAttribute('aria-current','true');
      button.onclick=()=>{if(n===index) closeDialog($('level-dialog'));else load(n);}; return button;
    }));
    openDialog('level-dialog');
  }
  $('levels').onclick=showLevels;$('help').onclick=()=>openDialog('help-dialog');
  $('undo').onclick=undo;$('redo').onclick=redo;$('restart').onclick=askRestart;
  $('confirm-restart').onclick=()=>load(index);
  $('review').onclick=()=>closeDialog($('win-dialog'));
  $('next').onclick=()=>{closeDialog($('win-dialog'));if(index<levels.length-1)load(index+1);else showLevels();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.closest('dialog')));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>stopHold()));
  const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
  document.addEventListener('keydown',event=>{
    if (celebrating && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); victory.end(); return; }
    if(event.ctrlKey||event.altKey||event.metaKey||document.querySelector('dialog[open]'))return;
    if(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
    const k=event.key.length===1?event.key.toLowerCase():event.key;
    if(keys[k]){event.preventDefault();step(keys[k]);}
    else if(['z','y','r'].includes(k)){event.preventDefault();if(k==='z')undo();else if(k==='y')redo();else if(!event.repeat)askRestart();}
  });
  document.querySelectorAll('[data-dir]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||holding)return;event.preventDefault();
      button.setPointerCapture(event.pointerId);const direction=button.dataset.dir;
      holding={pointer:event.pointerId};step(direction);
      if(holding) holding.delay=setTimeout(()=>{if(holding)holding.repeat=setInterval(()=>step(direction),140);},330);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,stopHold);
    // Native clicks support assistive technology and keyboard activation, while pointer input is handled above.
    button.addEventListener('click',event=>{if(event.detail===0)step(button.dataset.dir);});
    button.addEventListener('contextmenu',event=>event.preventDefault());
  });
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0||swipe)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);swipe={id:event.pointerId,x:event.clientX,y:event.clientY};});
  canvas.addEventListener('pointerup',event=>{
    if(!swipe||swipe.id!==event.pointerId)return;
    const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<14)return;
    step(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
  });
  canvas.addEventListener('pointercancel',()=>{swipe=null;});
  window.addEventListener('blur',()=>{stopHold();swipe=null;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopHold();swipe=null;save();}});
  window.addEventListener('resize',draw);
  restore();render();track('level_start');
})();
