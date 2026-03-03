/**
 * NormOS — apps/social.js  (v4.0)
 * Merged: Profile + Friends + Messaging (DMs)
 */

const SocialApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'social-wrap';
    const iid = Math.random().toString(36).slice(2, 6);
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fmt = (n) => Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

    const FRIENDS_KEY  = 'normos_friends';
    const loadFriends  = () => { try{return JSON.parse(localStorage.getItem(FRIENDS_KEY)||'[]');}catch{return[];} };
    const saveFriends  = (f) => { try{localStorage.setItem(FRIENDS_KEY,JSON.stringify(f));}catch{} };

    let friends     = loadFriends();
    let activeTab   = 'friends'; // 'friends' | 'profile' | 'messages'
    let dmTarget    = null; // { id, username, color }
    let dmHistory   = [];
    let unsubHandlers = [];

    wrap.innerHTML = `
      <div class="social-layout">
        <div class="social-sidebar">
          <div class="social-tabs">
            <button class="social-tab active" data-tab="friends">👥 Friends</button>
            <button class="social-tab" data-tab="messages">💬 Messages</button>
            <button class="social-tab" data-tab="profile">👤 Profile</button>
          </div>
          <div class="social-online-header">ONLINE</div>
          <div class="social-online-list" id="sc-online-${iid}"></div>
        </div>
        <div class="social-main" id="sc-main-${iid}"></div>
      </div>`;

    const onlineEl = wrap.querySelector(`#sc-online-${iid}`);
    const mainEl   = wrap.querySelector(`#sc-main-${iid}`);

    const getOnline = () => {
      try{ return (typeof Network!=='undefined'&&Network.getState)?Network.getState().online||[]:[];}
      catch{return[];}
    };

    const renderOnline = () => {
      const online = getOnline();
      if (!online.length) { onlineEl.innerHTML='<div class="sc-empty">No one online</div>'; return; }
      onlineEl.innerHTML = online.map(u=>`
        <div class="sc-online-item" data-id="${esc(u.id)}" data-username="${esc(u.username)}" data-color="${esc(u.color||'#4f9eff')}">
          <span style="color:${u.color||'#4ade80'};font-size:0.55rem">⬤</span>
          <span class="sc-online-name" style="color:${u.color||'#4ade80'}">${esc(u.username)}</span>
          <button class="sc-dm-btn" data-id="${esc(u.id)}" data-username="${esc(u.username)}" data-color="${esc(u.color||'#4f9eff')}">DM</button>
        </div>`).join('');
      onlineEl.querySelectorAll('.sc-dm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          dmTarget = {id:btn.dataset.id,username:btn.dataset.username,color:btn.dataset.color};
          activeTab = 'messages';
          setActiveTab('messages');
          renderMessages();
        });
      });
    };

    const setActiveTab = (tab) => {
      activeTab = tab;
      wrap.querySelectorAll('.social-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
      });
      switch(tab){
        case 'friends':  renderFriends(); break;
        case 'messages': renderMessages(); break;
        case 'profile':  renderProfile(); break;
      }
    };

    wrap.querySelectorAll('.social-tab').forEach(t => {
      t.addEventListener('click', () => setActiveTab(t.dataset.tab));
    });

    // ── FRIENDS TAB ──────────────────────────────────────────────────────
    const renderFriends = () => {
      const online = getOnline();
      const onlineNames = online.map(u=>u.username.toLowerCase());
      const onFriends   = friends.filter(f=>onlineNames.includes(f.toLowerCase()));
      const offFriends  = friends.filter(f=>!onlineNames.includes(f.toLowerCase()));

      mainEl.innerHTML = `
        <div class="sc-section">
          <div class="sc-section-title">👥 Friends</div>
          <div class="sc-add-row">
            <input class="sc-input" id="sc-add-inp-${iid}" placeholder="Add friend by username..." maxlength="32"/>
            <button class="sc-btn accent" id="sc-add-btn-${iid}">+ Add</button>
          </div>
          ${onFriends.length ? `<div class="sc-sub-label">ONLINE</div>
            ${onFriends.map(f=>{
              const u=online.find(u=>u.username.toLowerCase()===f.toLowerCase());
              return `<div class="sc-friend-item">
                <span style="color:${u?.color||'#4ade80'};font-size:0.55rem">⬤</span>
                <span style="color:${u?.color||'#4ade80'};font-size:0.8rem;flex:1">${esc(f)}</span>
                <span class="sc-badge green">ONLINE</span>
                <button class="sc-dm-btn sc-sm-btn" data-id="${esc(u?.id||'')}" data-username="${esc(f)}" data-color="${esc(u?.color||'#4f9eff')}">DM</button>
                <button class="sc-remove-btn sc-sm-btn" data-name="${esc(f)}">✕</button>
              </div>`;
            }).join('')}` : ''}
          ${offFriends.length ? `<div class="sc-sub-label">OFFLINE</div>
            ${offFriends.map(f=>`
              <div class="sc-friend-item">
                <span style="color:var(--text3);font-size:0.55rem">⬤</span>
                <span style="font-size:0.8rem;flex:1;color:var(--text2)">${esc(f)}</span>
                <span class="sc-badge">OFFLINE</span>
                <button class="sc-remove-btn sc-sm-btn" data-name="${esc(f)}">✕</button>
              </div>`).join('')}` : ''}
          ${!friends.length ? '<div class="sc-empty">No friends yet. Add someone!</div>' : ''}
        </div>`;

      mainEl.querySelector(`#sc-add-btn-${iid}`)?.addEventListener('click',()=>{
        const inp=mainEl.querySelector(`#sc-add-inp-${iid}`);
        const name=(inp.value||'').trim();
        if(!name) return;
        if(friends.find(f=>f.toLowerCase()===name.toLowerCase())){if(typeof OS!=='undefined')OS.notify('👥','Friends','Already friends!');return;}
        friends.push(name); saveFriends(friends);
        inp.value=''; renderFriends();
        if(typeof OS!=='undefined') OS.notify('👥','Friends',`Added ${name}!`);
      });
      mainEl.querySelector(`#sc-add-inp-${iid}`)?.addEventListener('keydown',e=>{if(e.key==='Enter')mainEl.querySelector(`#sc-add-btn-${iid}`).click();});
      mainEl.querySelectorAll('.sc-remove-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
          friends=friends.filter(f=>f!==btn.dataset.name); saveFriends(friends); renderFriends();
        });
      });
      mainEl.querySelectorAll('.sc-dm-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
          if(!btn.dataset.id) return;
          dmTarget={id:btn.dataset.id,username:btn.dataset.username,color:btn.dataset.color};
          setActiveTab('messages'); renderMessages();
        });
      });
    };

    // ── MESSAGES TAB ─────────────────────────────────────────────────────
    const renderMessages = () => {
      const online = getOnline();
      mainEl.innerHTML = `
        <div class="sc-section sc-messages-layout">
          <div class="sc-section-title">💬 Direct Messages</div>
          ${!dmTarget ? `
            <div class="sc-empty" style="padding:30px">Select someone from the Online list to start a DM.</div>
            <div class="sc-dm-contacts">
              ${online.map(u=>`<div class="sc-dm-contact" data-id="${esc(u.id)}" data-username="${esc(u.username)}" data-color="${esc(u.color||'#4f9eff')}">
                <span style="color:${u.color||'#4ade80'};font-size:0.6rem">⬤</span>
                <span style="color:${u.color||'#4ade80'};font-size:0.8rem">${esc(u.username)}</span>
              </div>`).join('')}
            </div>` :
            `<div class="sc-dm-header">
              <button class="sc-btn" id="sc-dm-back-${iid}" style="font-size:0.7rem;padding:4px 10px;">← Back</button>
              <span style="color:${dmTarget.color||'#4f9eff'};font-weight:bold;font-size:0.85rem">⬤ ${esc(dmTarget.username)}</span>
            </div>
            <div class="sc-dm-messages" id="sc-dm-msgs-${iid}"></div>
            <div class="sc-dm-input-row">
              <input class="sc-input sc-dm-input" id="sc-dm-txt-${iid}" placeholder="Message ${esc(dmTarget.username)}..." />
              <label class="sc-file-label" title="Attach file">📎<input type="file" id="sc-dm-file-${iid}" style="display:none" /></label>
              <button class="sc-btn accent" id="sc-dm-send-${iid}">Send</button>
            </div>
            <div id="sc-file-preview-${iid}" style="font-size:0.68rem;color:var(--text3);padding:0 4px;min-height:16px;"></div>`}
        </div>`;

      mainEl.querySelectorAll('.sc-dm-contact').forEach(el=>{
        el.addEventListener('click',()=>{
          dmTarget={id:el.dataset.id,username:el.dataset.username,color:el.dataset.color};
          renderMessages();
        });
      });

      if (!dmTarget) return;

      mainEl.querySelector(`#sc-dm-back-${iid}`)?.addEventListener('click',()=>{dmTarget=null;renderMessages();});

      const msgsEl = mainEl.querySelector(`#sc-dm-msgs-${iid}`);
      let attachedFile = null;

      const appendDmMsg = (m) => {
        const myId = typeof Network!=='undefined'?Network.getState().myId:null;
        const mine = m.fromId===myId;
        const el=document.createElement('div');
        el.className='sc-dm-msg '+(mine?'mine':'theirs');
        let body=`<span class="sc-dm-text">${esc(m.text||'')}</span>`;
        if(m.file&&m.file.dataUrl){
          if(m.file.type&&m.file.type.startsWith('image/')){
            body+=`<br><img src="${esc(m.file.dataUrl)}" style="max-width:200px;max-height:150px;border-radius:4px;margin-top:4px;" />`;
          } else {
            body+=`<br><a href="${esc(m.file.dataUrl)}" download="${esc(m.file.name||'file')}" style="color:var(--accent);font-size:0.7rem;">📎 ${esc(m.file.name||'file')}</a>`;
          }
        }
        el.innerHTML=`<div class="sc-dm-bubble" style="background:${mine?'var(--accent)':'var(--bg3)'}">${body}</div><div class="sc-dm-ts">${esc(m.ts||'')}</div>`;
        msgsEl.appendChild(el);
        msgsEl.scrollTop=msgsEl.scrollHeight;
      };

      // Load history
      if(typeof Network!=='undefined'&&Network.isConnected()){
        Network.getDmHistory(dmTarget.id);
      }

      const doSend = () => {
        const txt=(mainEl.querySelector(`#sc-dm-txt-${iid}`)?.value||'').trim();
        if(!txt&&!attachedFile) return;
        mainEl.querySelector(`#sc-dm-txt-${iid}`).value='';
        const myState=typeof Network!=='undefined'?Network.getState():{};
        const tmpMsg={fromId:myState.myId,from:myState.username||'me',text:txt,file:attachedFile,ts:new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})};
        appendDmMsg(tmpMsg);
        if(typeof Network!=='undefined'&&Network.isConnected()){
          Network.sendDm(dmTarget.id,txt,attachedFile);
        }
        attachedFile=null;
        const prev=mainEl.querySelector(`#sc-file-preview-${iid}`);
        if(prev) prev.textContent='';
      };

      mainEl.querySelector(`#sc-dm-send-${iid}`)?.addEventListener('click',doSend);
      mainEl.querySelector(`#sc-dm-txt-${iid}`)?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}});

      // File attach
      mainEl.querySelector(`#sc-dm-file-${iid}`)?.addEventListener('change',function(){
        const file=this.files[0]; if(!file) return;
        const reader=new FileReader();
        reader.onload=ev=>{
          attachedFile={name:file.name,dataUrl:ev.target.result,type:file.type};
          const prev=mainEl.querySelector(`#sc-file-preview-${iid}`);
          if(prev) prev.textContent=`📎 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
        };
        reader.readAsDataURL(file);
      });
    };

    // ── PROFILE TAB ──────────────────────────────────────────────────────
    const renderProfile = () => {
      const PROFILE_KEY='normos_profile';
      const p=(()=>{try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}');}catch{return{};}})();
      const myState=typeof Network!=='undefined'?Network.getState():{};
      const balance=typeof Economy!=='undefined'?Economy.state.balance:0;
      const netWorth=typeof Economy!=='undefined'?Economy.totalValue():0;
      const badges=(p.badges||[]);
      const ALL_BADGES=[
        {id:'loan_shark',icon:'🦈',name:'Loan Shark','desc':'Took out a loan'},
        {id:'bankrupt',  icon:'💀',name:'Bankrupt',  'desc':'Defaulted on a loan'},
        {id:'miner',     icon:'⛏️',name:'Miner',      'desc':'Bought a mining upgrade'},
        {id:'gambler',   icon:'🎰',name:'Gambler',    'desc':'Played at the casino'},
        {id:'investor',  icon:'📈',name:'Investor',   'desc':'Made a stock trade'},
      ];

      mainEl.innerHTML=`
        <div class="sc-section">
          <div class="sc-section-title">👤 My Profile</div>
          <div class="sc-profile-card">
            <div class="sc-profile-avatar" style="color:${myState.myColor||'#4f9eff'}">${(myState.username||'?')[0].toUpperCase()}</div>
            <div class="sc-profile-info">
              <div style="font-size:1rem;font-weight:bold;color:${myState.myColor||'#4f9eff'}">${esc(myState.username||'Unknown')}</div>
              <div style="font-size:0.7rem;color:var(--text3)">ID: ${esc(myState.myId||'offline')}</div>
              <div style="font-size:0.72rem;color:#4ade80;margin-top:4px">Cash: $${fmt(balance)}</div>
              <div style="font-size:0.72rem;color:#4f9eff">Net Worth: $${fmt(netWorth)}</div>
            </div>
          </div>
          <div class="sc-sub-label" style="margin-top:14px">STATUS MESSAGE</div>
          <div style="display:flex;gap:8px;">
            <input class="sc-input" id="sc-status-${iid}" value="${esc(p.status||'')}" placeholder="Set a status..." maxlength="80"/>
            <button class="sc-btn accent" id="sc-status-save-${iid}">Save</button>
          </div>
          <div class="sc-sub-label" style="margin-top:14px">BADGES</div>
          <div class="sc-badges">
            ${ALL_BADGES.map(b=>`
              <div class="sc-badge-item ${badges.includes(b.id)?'earned':'locked'}" title="${esc(b.desc)}">
                <span>${b.icon}</span>
                <span style="font-size:0.65rem">${esc(b.name)}</span>
              </div>`).join('')}
          </div>
        </div>`;

      mainEl.querySelector(`#sc-status-save-${iid}`)?.addEventListener('click',()=>{
        p.status=mainEl.querySelector(`#sc-status-${iid}`).value||'';
        try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}catch{}
        if(typeof OS!=='undefined') OS.notify('👤','Profile','Status updated!');
      });
    };

    // Network subscriptions
    if(typeof Network!=='undefined'){
      const onOnline=(users)=>{ renderOnline(); if(activeTab==='friends') renderFriends(); };
      const onDmReceive=(msg)=>{
        if(typeof OS!=='undefined') OS.notify('💬',`DM from ${msg.from}`,(msg.text||'').slice(0,60));
        if(activeTab==='messages'&&dmTarget&&msg.fromId===dmTarget.id){
          const msgsEl=mainEl.querySelector(`#sc-dm-msgs-${iid}`);
          if(msgsEl){
            const el=document.createElement('div');
            el.className='sc-dm-msg theirs';
            let body=`<span class="sc-dm-text">${esc(msg.text||'')}</span>`;
            if(msg.file?.dataUrl){
              if(msg.file.type?.startsWith('image/')){body+=`<br><img src="${esc(msg.file.dataUrl)}" style="max-width:200px;border-radius:4px;margin-top:4px;">`;}
              else{body+=`<br><a href="${esc(msg.file.dataUrl)}" download="${esc(msg.file.name||'file')}" style="color:var(--accent);font-size:0.7rem">📎 ${esc(msg.file.name||'file')}</a>`;}
            }
            el.innerHTML=`<div class="sc-dm-bubble" style="background:var(--bg3)">${body}</div><div class="sc-dm-ts">${esc(msg.ts||'')}</div>`;
            msgsEl.appendChild(el);
            msgsEl.scrollTop=msgsEl.scrollHeight;
          }
        }
      };
      const onDmHistory=(data)=>{
        if(activeTab!=='messages') return;
        dmHistory=data.messages||[];
        const msgsEl=mainEl.querySelector(`#sc-dm-msgs-${iid}`);
        if(!msgsEl) return;
        msgsEl.innerHTML='';
        dmHistory.forEach(m=>{
          const myId=Network.getState().myId;
          const mine=m.fromId===myId;
          const el=document.createElement('div');
          el.className='sc-dm-msg '+(mine?'mine':'theirs');
          let body=`<span class="sc-dm-text">${esc(m.text||'')}</span>`;
          if(m.file?.dataUrl){
            if(m.file.type?.startsWith('image/')){body+=`<br><img src="${esc(m.file.dataUrl)}" style="max-width:200px;border-radius:4px;margin-top:4px;">`;}
            else{body+=`<br><a href="${esc(m.file.dataUrl)}" download="${esc(m.file.name||'file')}" style="color:var(--accent);font-size:0.7rem">📎 ${esc(m.file.name||'file')}</a>`;}
          }
          el.innerHTML=`<div class="sc-dm-bubble" style="background:${mine?'var(--accent)':'var(--bg3)'}">${body}</div><div class="sc-dm-ts">${esc(m.ts||'')}</div>`;
          msgsEl.appendChild(el);
        });
        msgsEl.scrollTop=msgsEl.scrollHeight;
      };
      Network.on('online:update',onOnline);
      Network.on('dm:receive',onDmReceive);
      Network.on('dm:history',onDmHistory);
      unsubHandlers=[
        ()=>Network.off('online:update',onOnline),
        ()=>Network.off('dm:receive',onDmReceive),
        ()=>Network.off('dm:history',onDmHistory),
      ];
    }

    renderOnline();
    setActiveTab('friends');

    // Cleanup
    const obs=new MutationObserver(()=>{
      if(!document.body.contains(wrap)){
        unsubHandlers.forEach(fn=>fn());
        obs.disconnect();
      }
    });
    obs.observe(document.body,{childList:true,subtree:true});

    if(!document.getElementById('social-styles')){
      const st=document.createElement('style');st.id='social-styles';
      st.textContent=`
        .social-wrap{height:100%;overflow:hidden;background:var(--bg1);display:flex;}
        .social-layout{display:flex;height:100%;width:100%;}
        .social-sidebar{width:180px;min-width:180px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;}
        .social-tabs{display:flex;flex-direction:column;gap:2px;padding:8px;}
        .social-tab{background:transparent;border:none;color:var(--text2);padding:8px 10px;text-align:left;font-size:0.75rem;cursor:pointer;border-radius:5px;}
        .social-tab.active,.social-tab:hover{background:var(--accent);color:#fff;}
        .social-online-header{font-size:0.62rem;font-weight:bold;color:var(--text3);padding:6px 12px;letter-spacing:.08em;}
        .social-online-list{flex:1;overflow-y:auto;padding:4px 8px;display:flex;flex-direction:column;gap:3px;}
        .sc-online-item{display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:5px;background:var(--bg1);border:1px solid var(--border);}
        .sc-online-name{font-size:0.72rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .sc-dm-btn{font-size:0.62rem;background:var(--accent);color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;}
        .social-main{flex:1;overflow-y:auto;}
        .sc-section{padding:16px;display:flex;flex-direction:column;gap:10px;height:100%;box-sizing:border-box;}
        .sc-section-title{font-size:0.85rem;font-weight:bold;color:var(--text1);margin-bottom:4px;}
        .sc-add-row,.sc-dm-input-row{display:flex;gap:8px;}
        .sc-input{flex:1;background:var(--bg1);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:0.8rem;padding:7px 10px;}
        .sc-btn{border:none;border-radius:5px;padding:7px 14px;font-size:0.75rem;cursor:pointer;font-weight:600;background:var(--bg3);color:var(--text1);}
        .sc-btn.accent{background:var(--accent);color:#fff;}
        .sc-btn:hover{opacity:.85;}
        .sc-sm-btn{font-size:0.65rem;padding:3px 8px;}
        .sc-sub-label{font-size:0.62rem;font-weight:bold;color:var(--text3);letter-spacing:.08em;}
        .sc-friend-item{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:6px;background:var(--bg2);border:1px solid var(--border);}
        .sc-badge{font-size:0.6rem;font-weight:bold;padding:2px 6px;border-radius:10px;background:var(--bg3);color:var(--text3);}
        .sc-badge.green{background:rgba(74,222,128,.15);color:#4ade80;}
        .sc-empty{font-size:0.75rem;color:var(--text3);font-style:italic;padding:8px;}
        .sc-messages-layout{height:100%;display:flex;flex-direction:column;}
        .sc-dm-header{display:flex;align-items:center;gap:10px;padding-bottom:8px;border-bottom:1px solid var(--border);}
        .sc-dm-messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:8px 0;}
        .sc-dm-msg{display:flex;flex-direction:column;}
        .sc-dm-msg.mine{align-items:flex-end;}
        .sc-dm-msg.theirs{align-items:flex-start;}
        .sc-dm-bubble{padding:8px 12px;border-radius:10px;font-size:0.78rem;max-width:70%;word-break:break-word;}
        .sc-dm-ts{font-size:0.6rem;color:var(--text3);margin-top:2px;}
        .sc-dm-input{flex:1;}
        .sc-dm-contacts{display:flex;flex-direction:column;gap:4px;margin-top:8px;}
        .sc-dm-contact{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;background:var(--bg2);border:1px solid var(--border);cursor:pointer;}
        .sc-dm-contact:hover{border-color:var(--accent);}
        .sc-file-label{padding:6px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-size:0.85rem;}
        .sc-profile-card{display:flex;gap:14px;align-items:center;padding:14px;background:var(--bg2);border-radius:8px;border:1px solid var(--border);}
        .sc-profile-avatar{width:56px;height:56px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:bold;}
        .sc-badges{display:flex;flex-wrap:wrap;gap:8px;}
        .sc-badge-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px;border-radius:8px;background:var(--bg2);border:1px solid var(--border);min-width:60px;text-align:center;}
        .sc-badge-item.earned{border-color:rgba(250,204,21,.4);}
        .sc-badge-item.locked{opacity:.4;}
      `;
      document.head.appendChild(st);
    }

    return wrap;
  }
};

// Aliases so old code still works
const ProfileApp = { create: () => SocialApp.create() };
const FriendsApp = { create: () => SocialApp.create() };