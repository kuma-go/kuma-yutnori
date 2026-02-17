const SKINS = { bear: { icon: '🐻', name: '곰' }, tiger: { icon: '🐯', name: '호랑이' }, rabbit: { icon: '🐰', name: '토끼' }, dog: { icon: '🐶', name: '강아지' }, pig: { icon: '🐷', name: '돼지' }, sheep: { icon: '🐑', name: '양' }, cow: { icon: '🐮', name: '소' }, horse: { icon: '🐴', name: '말' } };
const TEAMS_DEFAULT = [ { id: 'red', color: '#D9463E', label: '홍팀' }, { id: 'blue', color: '#2A6496', label: '청팀' }, { id: 'green', color: '#05c46b', label: '초록팀' }, { id: 'yellow', color: '#ECA328', label: '노랑팀' } ];

let gameState = { teams: [], currentTeamIdx: 0, tokens: {}, waitingStep: null, selectedTokenId: null };
let setupState = { teamCount: 2, tokenCount: 4, selectedSkins: ['bear', 'tiger', 'rabbit', 'dog'], rules: { backdoApply: 'on', startBackdo: 'penalty', backdoRoute: 'history', goalCond: 'stand', extraThrow: 'stack', branchRoute: 'shortcut' } };

const nodes = {};
function initNodes() {
    const set = (id, x, y) => nodes[id] = { id, x, y, next: null, shortcut: null };
    set(0, 90, 90); set(1, 90, 74); set(2, 90, 58); set(3, 90, 42); set(4, 90, 26);
    set(5, 90, 10); set(6, 74, 10); set(7, 58, 10); set(8, 42, 10); set(9, 26, 10);
    set(10, 10, 10); set(11, 10, 26); set(12, 10, 42); set(13, 10, 58); set(14, 10, 74);
    set(15, 10, 90); set(16, 26, 90); set(17, 42, 90); set(18, 58, 90); set(19, 74, 90);
    set(20, 74, 26); set(21, 58, 42); set(22, 50, 50); 
    set(23, 26, 26); set(24, 42, 42); set(25, 42, 58); set(26, 26, 74);
    set(27, 58, 58); set(28, 74, 74);

    for(let i=0; i<19; i++) nodes[i].next = i+1; nodes[19].next = 0;
    nodes[20].next=21; nodes[21].next=22; nodes[23].next=24; nodes[24].next=22;
    nodes[25].next=26; nodes[26].next=15; // 26->15 연결
    nodes[27].next=28; nodes[28].next=0; // 28->0 연결
    
    // 중앙점(22) 기본 next 설정 (끊김 방지)
    nodes[22].next = 27;

    nodes[5].shortcut = 20; nodes[10].shortcut = 23; nodes[22].shortcut = 27;
    [0, 5, 10, 15, 22].forEach(id => nodes[id].isCorner = true);
}

window.onload = () => { initNodes(); drawBoard(); drawLines(); showScreen('screen-home'); };
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }

function goToTeamSetup() {
    const getVal = (n) => { const el = document.querySelector(`input[name="${n}"]:checked`); return el ? el.value : setupState.rules[n]; };
    setupState.rules.backdoApply = getVal('backdo_apply');
    setupState.rules.startBackdo = getVal('start_backdo');
    setupState.rules.backdoRoute = getVal('backdo_route');
    setupState.rules.goalCond = getVal('goal_cond');
    setupState.rules.extraThrow = getVal('extra_throw');
    setupState.rules.branchRoute = getVal('branch_route');
    showScreen('screen-setup'); renderSetupUI();
}
function initTeamSetup() { showScreen('screen-rules-setup'); } 

function changeTeamCount(d) { let v = setupState.teamCount + d; if(v<2)v=2;if(v>4)v=4; setupState.teamCount=v; renderSetupUI(); }
function changeTokenCount(d) { let v = setupState.tokenCount + d; if(v<1)v=1;if(v>8)v=8; setupState.tokenCount=v; renderSetupUI(); }
function selectSkin(t, s) { for(let i=0;i<setupState.teamCount;i++) if(i!==t && setupState.selectedSkins[i]===s)return; setupState.selectedSkins[t]=s; renderSetupUI(); }
function renderSetupUI() {
    document.getElementById('team-count').value = setupState.teamCount;
    document.getElementById('token-count').value = setupState.tokenCount;
    const c = document.getElementById('team-settings-list'); c.innerHTML='';
    for(let i=0; i<setupState.teamCount; i++) {
        const def=TEAMS_DEFAULT[i]; let h='<div class="skin-grid">';
        for(const [k,v] of Object.entries(SKINS)) {
            let dis=''; for(let j=0;j<setupState.teamCount;j++) if(i!==j && setupState.selectedSkins[j]===k) dis='disabled';
            let sel = (setupState.selectedSkins[i]===k)?'selected':'';
            h+=`<div class="skin-item ${sel} ${dis}" onclick="selectSkin(${i},'${k}')"><span class="skin-icon">${v.icon}</span><span class="skin-name">${v.name}</span></div>`;
        }
        h+='</div>'; const div=document.createElement('div'); div.className='config-card'; div.style.borderLeft=`5px solid ${def.color}`;
        div.innerHTML=`<span style="color:${def.color};font-weight:bold;display:block;margin-bottom:10px">${def.label}</span>${h}`; c.appendChild(div);
    }
}

function startGame() {
    gameState.teams = []; gameState.tokens = {};
    for(let i=0; i<setupState.teamCount; i++) {
        const def = TEAMS_DEFAULT[i]; const skinKey = setupState.selectedSkins[i];
        gameState.teams.push({ id: def.id, name: def.label, color: def.color, skinIcon: SKINS[skinKey].icon, score: 0 });
        const tokens = [];
        for(let j=0; j<setupState.tokenCount; j++) tokens.push({ id: j, pos: -1, history: [], started: false });
        gameState.tokens[def.id] = tokens;
    }
    gameState.currentTeamIdx = 0; gameState.waitingStep = null; gameState.selectedTokenId = null;
    updateUI(); showScreen('screen-game');
}

function selectYutResult(step) {
    if (step === -1 && setupState.rules.backdoApply === 'off') { alert("빽도 미적용"); return; }
    gameState.waitingStep = step; gameState.selectedTokenId = null;
    document.getElementById('input-panel').classList.add('hidden');
    document.getElementById('cancel-move-btn').classList.remove('hidden');
    const msg = step > 0 ? (step===4?"윷":step===5?"모":step+"칸") : "빽도";
    document.getElementById('status-message').innerText = `${msg} - 말을 선택하세요`;
    updateUI();
}
function cancelYutSelection() {
    gameState.waitingStep = null; gameState.selectedTokenId = null;
    document.getElementById('input-panel').classList.remove('hidden');
    document.getElementById('cancel-move-btn').classList.add('hidden');
    document.getElementById('goal-zone').classList.add('hidden');
    document.getElementById('status-message').innerText = "윷 결과를 입력하세요";
    clearGhosts(); updateUI();
}
function handleTokenClick(token, teamId) {
    if (gameState.waitingStep === null) return;
    if (teamId !== gameState.teams[gameState.currentTeamIdx].id) return;
    gameState.selectedTokenId = token.id; updateUI(); showGhostsForToken(token);
}

function toggleRulePopup() {
    const modal = document.getElementById('rule-popup-modal');
    if (modal.classList.contains('hidden')) {
        const list = document.getElementById('rule-summary-list');
        list.innerHTML = `
            <li><strong>빽도:</strong> ${setupState.rules.backdoApply==='on'?'적용':'미적용'}</li>
            <li><strong>도착점:</strong> ${setupState.rules.goalCond==='stand'?'대기(정확히)':'지나침 허용'}</li>
            <li><strong>분기점 출발:</strong> ${setupState.rules.branchRoute==='shortcut'?'지름길':'선택'}</li>
            <li><strong>빽도 경로:</strong> ${setupState.rules.backdoRoute==='history'?'왔던 길':'선택'}</li>
        `;
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function showGhostsForToken(token) {
    clearGhosts(); 
    const goalBtn = document.getElementById('goal-zone');
    goalBtn.classList.add('hidden');
    const newGoalBtn = goalBtn.cloneNode(true);
    goalBtn.parentNode.replaceChild(newGoalBtn, goalBtn);

    const dests = calculateDestinations(token, gameState.waitingStep);

    if (dests.length === 0) {
        if (gameState.waitingStep === -1 && token.pos === -1 && setupState.rules.startBackdo === 'penalty') {
            if(confirm("출발 전 빽도! 턴을 넘기시겠습니까?")) passTurn(); else cancelYutSelection();
        } else alert("이동할 수 없습니다.");
        return;
    }

    const board = document.getElementById('yut-board');
    dests.forEach(d => {
        if (d.pos === 999) {
            const g = document.getElementById('goal-zone');
            g.classList.remove('hidden');
            g.onclick = (e) => { e.stopPropagation(); executeMove(token, d); };
        } else {
            const ghost = document.createElement('div'); ghost.className = 'ghost';
            ghost.style.left = nodes[d.pos].x + '%'; ghost.style.top = nodes[d.pos].y + '%';
            ghost.onclick = (e) => { e.stopPropagation(); executeMove(token, d); };
            board.appendChild(ghost);
        }
    });
}

function calculateDestinations(token, steps) {
    let currentPos = token.pos;
    let history = [...token.history];
    let started = token.started;

    if (steps === -1) {
        if (currentPos === 999 || currentPos === -1) return [];
        // 도(1) -> 빽도 = 0번(도착점) (요청 반영)
        if (currentPos === 1) return [{ pos: 0, hist: [], st: true }];
        
        if (history.length > 0) {
            let tempHist = [...history];
            let prev = tempHist.pop();
            if (prev === currentPos && tempHist.length > 0) prev = tempHist.pop();
            else if (prev === currentPos && tempHist.length === 0) return [{pos: -1, hist: [], st: false}];
            if (prev === undefined) prev = -1;
            return [{ pos: prev, hist: tempHist, st: (prev !== -1) }];
        }
        if (currentPos === 0) return [{ pos: 19, hist: [], st: true }];
        return [];
    }

    let cands = [];
    if (currentPos === -1) {
        cands.push({ pos: 1, rem: steps-1, hist: [1], st: true });
    } else {
        if (currentPos === 0 && started) return [{ pos: 999, hist: [], st: true }];

        let nexts = [];
        if (nodes[currentPos].next !== null) nexts.push(nodes[currentPos].next);
        
        if (nodes[currentPos].shortcut) {
            if (setupState.rules.branchRoute === 'select') nexts.push(nodes[currentPos].shortcut);
            else nexts = [nodes[currentPos].shortcut];
        }
        if (currentPos === 22) { 
            if (setupState.rules.branchRoute === 'select') nexts = [25, 27];
            else nexts = [27]; 
        }
        
        nexts.forEach(n => cands.push({ pos: n, rem: steps-1, hist: [...history, n], st: true }));
    }

    let results = [];
    cands.forEach(c => {
        let p = c.pos, r = c.rem, h = c.hist;
        let loopPrev = currentPos; 

        if (r > 0 && h.length > 0) {
             let lastHist = h[h.length - 1];
             if (lastHist === p) {
                 if (h.length >= 2) loopPrev = h[h.length - 2];
             } else {
                 loopPrev = lastHist;
             }
        }

        for (let i=0; i<r; i++) {
            if (p === 999) break;
            
            // 안전장치
            if (!nodes[p]) break; 

            let nextP = nodes[p].next;
            
            // 중앙(22) 관성 - Force Next Logic
            if (p === 22) {
                if (loopPrev === 21) nextP = 25; 
                else if (loopPrev === 24) nextP = 27; 
                else nextP = 27; 
            }

            if ((p === 19 || p === 28) && nextP === 0) {
                if (i === r-1) { 
                    if (setupState.rules.goalCond === 'over') p = 999; else p = 0;
                } else p = 999; 
            } else if (p === 0) {
                p = 999;
            } else {
                loopPrev = p; // 이동 전 위치 업데이트
                p = nextP;
            }
            if (p !== 999) h.push(p);
        }
        results.push({ pos: p, hist: h, st: c.st });
    });
    
    const uniq = []; const map = new Map();
    results.forEach(r => { if(!map.has(r.pos)){ map.set(r.pos, true); uniq.push(r); } });
    return uniq;
}

function executeMove(token, dest) {
    const curTeam = gameState.teams[gameState.currentTeamIdx];
    const steps = gameState.waitingStep;
    let movers = [token];
    if (token.pos !== -1) movers = gameState.tokens[curTeam.id].filter(t => t.pos === token.pos);

    movers.forEach(t => { t.pos = dest.pos; t.history = [...dest.hist]; t.started = dest.st; });

    if (dest.pos === 999) {
        curTeam.score += movers.length;
        document.getElementById('status-message').innerText = "골인!";
        movers.forEach(t => { t.pos = 999; t.history = []; });
    }

    let caught = false;
    if (dest.pos !== 999 && dest.pos !== -1) {
        gameState.teams.forEach(tm => {
            if (tm.id === curTeam.id) return;
            const enemies = gameState.tokens[tm.id].filter(t => t.pos === dest.pos);
            if (enemies.length > 0) {
                enemies.forEach(e => { e.pos = -1; e.history = []; e.started = false; });
                caught = true; alert(`[${tm.name}] 말을 잡았습니다!`);
            }
        });
    }

    cancelYutSelection(); updateUI();
    if (curTeam.score >= setupState.tokenCount) { setTimeout(() => showWin(curTeam), 500); return; }

    let bonus = (steps >= 4 || (caught && setupState.rules.extraThrow === 'stack'));
    if (bonus) document.getElementById('status-message').innerText = "한 번 더!";
    else if (dest.pos === 999) setTimeout(passTurn, 1000);
    else passTurn();
}

function handleNak() { if(confirm("턴을 넘길까요?")) passTurn(); }
function passTurn() { gameState.currentTeamIdx = (gameState.currentTeamIdx + 1) % gameState.teams.length; cancelYutSelection(); updateUI(); }
function resetGame() { if(confirm("초기화?")) location.reload(); }
function confirmExit() { if(confirm("나가기?")) showScreen('screen-home'); }
function showWin(t) { document.getElementById('winner-icon').innerText = t.skinIcon; document.getElementById('winner-name').innerText = t.name; document.getElementById('winner-name').style.color=t.color; showScreen('screen-result'); }
function clearGhosts() { document.querySelectorAll('.ghost').forEach(e => e.remove()); }

function drawBoard() {
    const b = document.getElementById('yut-board');
    Array.from(b.children).forEach(c => {
        if(c.classList.contains('node') || c.classList.contains('token') || c.classList.contains('ghost')) b.removeChild(c);
    });
    
    Object.values(nodes).forEach(n => {
        const d = document.createElement('div'); d.className = 'node';
        if(n.isCorner) d.classList.add('corner'); d.style.left=n.x+'%'; d.style.top=n.y+'%'; b.appendChild(d);
    });
}
function drawLines() {
    const s = document.getElementById('board-lines'); s.innerHTML='';
    const l = (n1,n2) => { const el=document.createElementNS("http://www.w3.org/2000/svg","line"); el.setAttribute("x1",n1.x+"%"); el.setAttribute("y1",n1.y+"%"); el.setAttribute("x2",n2.x+"%"); el.setAttribute("y2",n2.y+"%"); s.appendChild(el); };
    Object.values(nodes).forEach(n=>{ if(n.next && !(n.id===19 && n.next===0)) l(n,nodes[n.next]); if(n.shortcut) l(n,nodes[n.shortcut]); });
    l(nodes[22],nodes[25]); l(nodes[22],nodes[27]); l(nodes[19], nodes[0]); l(nodes[28], nodes[0]); l(nodes[26], nodes[15]);
}
function updateUI() {
    document.getElementById('btn-backdo').disabled = (setupState.rules.backdoApply === 'off');
    const cur = gameState.teams[gameState.currentTeamIdx];
    document.getElementById('current-team-badge').innerText = cur.skinIcon;
    document.getElementById('current-team-badge').style.backgroundColor = cur.color;
    document.getElementById('turn-text').innerText = cur.name;
    document.getElementById('goal-count').innerText = `골인: ${cur.score}/${setupState.tokenCount}`;

    const tray = document.getElementById('waiting-trays'); tray.innerHTML = '';
    gameState.teams.forEach(t => {
        const div = document.createElement('div'); div.className = `team-tray ${t.id === cur.id ? 'active' : ''}`;
        div.style.backgroundColor = t.id === cur.id ? t.color + '22' : 'transparent';
        div.style.borderColor = t.id === cur.id ? t.color : '#eee';
        
        gameState.tokens[t.id].filter(k => k.pos === -1).forEach(k => {
            const el = document.createElement('div'); el.className = 'tray-token';
            el.innerText = t.skinIcon; el.style.borderColor = t.color;
            if(t.id === cur.id && gameState.waitingStep !== null) {
                el.classList.add('selectable');
                if(gameState.selectedTokenId === k.id) el.classList.add('selected');
            }
            el.onclick = () => handleTokenClick(k, t.id); div.appendChild(el);
        });
        tray.appendChild(div);
    });

    document.querySelectorAll('#yut-board .token').forEach(e => e.remove());
    gameState.teams.forEach(t => {
        const onBoard = gameState.tokens[t.id].filter(k => k.pos !== -1 && k.pos !== 999);
        const grouped = {}; onBoard.forEach(k => { if(!grouped[k.pos]) grouped[k.pos]=[]; grouped[k.pos].push(k); });
        for(const [pos, arr] of Object.entries(grouped)) {
            const el = document.createElement('div'); el.className = 'token';
            el.dataset.team = t.id; el.style.borderColor = t.color; el.innerText = t.skinIcon;
            if(nodes[pos]) { el.style.left=nodes[pos].x+'%'; el.style.top=nodes[pos].y+'%'; }
            if(arr.length > 1) el.innerHTML += `<small style="border-color:${t.color};background:${t.color}">x${arr.length}</small>`;
            if(t.id === cur.id && gameState.waitingStep !== null) {
                el.classList.add('selectable');
                if(gameState.selectedTokenId === arr[0].id) el.classList.add('selected');
            }
            el.onclick = () => handleTokenClick(arr[0], t.id); document.getElementById('yut-board').appendChild(el);
        }
    });
}