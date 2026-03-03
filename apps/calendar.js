/**
 * NormOS — apps/calendar.js
 * Calendar with events
 */
const CalendarApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'cal-wrap';

    let now = new Date();
    let viewYear = now.getFullYear();
    let viewMonth = now.getMonth();
    let selectedDay = null;

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    let events = JSON.parse(localStorage.getItem('normos_cal_events') || '{}');
    const saveEvents = () => { try { localStorage.setItem('normos_cal_events', JSON.stringify(events)); } catch {} };

    // Seed some events
    if (Object.keys(events).length === 0) {
      const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      events[today] = [{ title: 'daemon.norm check-in', time: '09:00' }];
      const tom = new Date(now); tom.setDate(now.getDate() + 2);
      const tomKey = `${tom.getFullYear()}-${tom.getMonth()}-${tom.getDate()}`;
      events[tomKey] = [{ title: 'NormOS system update', time: '14:00' }];
      saveEvents();
    }

    const render = () => {
      const firstDay = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

      const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      const selKey = selectedDay ? `${selectedDay.y}-${selectedDay.m}-${selectedDay.d}` : null;
      const selEvents = selKey && events[selKey] ? events[selKey] : [];

      wrap.innerHTML = `
        <div class="cal-header">
          <button class="cal-nav" id="cal-prev">‹</button>
          <div class="cal-month-title">${MONTHS[viewMonth]} ${viewYear}</div>
          <button class="cal-nav" id="cal-next">›</button>
          <button class="os-btn" id="cal-today" style="margin-left:0.5rem;font-size:0.65rem;padding:0.2rem 0.5rem;">Today</button>
        </div>
        <div class="cal-full">
          <div class="cal-main">
            <div class="cal-grid-wrap">
              <div class="cal-grid">
                ${DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('')}
                ${Array.from({length: 42}, (_, i) => {
                  let day, month = viewMonth, year = viewYear, cls = '';
                  if (i < firstDay) { day = daysInPrev - firstDay + i + 1; month = viewMonth - 1; cls = 'other-month'; if (month < 0) { month = 11; year--; } }
                  else if (i >= firstDay + daysInMonth) { day = i - firstDay - daysInMonth + 1; month = viewMonth + 1; cls = 'other-month'; if (month > 11) { month = 0; year++; } }
                  else { day = i - firstDay + 1; }
                  const key = `${year}-${month}-${day}`;
                  const isToday = key === todayKey && cls === '';
                  const isSel = selKey && key === selKey;
                  if (isToday) cls += ' today';
                  if (isSel) cls += ' selected';
                  const dayEvts = events[key] || [];
                  return `<div class="cal-day ${cls}" data-key="${key}" data-d="${day}" data-m="${month}" data-y="${year}">
                    <div class="cal-day-num">${day}</div>
                    ${dayEvts.slice(0,2).map(e => `<div class="cal-event">${e.title}</div>`).join('')}
                    ${dayEvts.length > 2 ? `<div style="font-size:0.5rem;color:var(--text3);">+${dayEvts.length-2} more</div>` : ''}
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div class="cal-sidebar">
            <div style="font-weight:700;color:var(--text);font-size:0.78rem;">
              ${selectedDay ? `${MONTHS[selectedDay.m]} ${selectedDay.d}` : 'Select a day'}
            </div>
            <button class="cal-add-btn" id="cal-add-evt" ${!selectedDay ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>+ Add Event</button>
            <div class="cal-event-list">
              ${selEvents.length === 0 ? '<div style="color:var(--text3);font-size:0.68rem;">No events</div>' :
                selEvents.map((e, i) => `
                  <div class="cal-event-item">
                    <div class="cal-event-item-title">${e.title}</div>
                    <div class="cal-event-item-time">${e.time || 'All day'}</div>
                    <button onclick="this.closest('.cal-event-item').remove()" style="font-size:0.6rem;background:none;border:none;color:var(--text3);cursor:pointer;float:right;margin-top:-1.2rem;" data-idx="${i}">✕</button>
                  </div>`).join('')}
            </div>
          </div>
        </div>
      `;

      wrap.querySelector('#cal-prev').addEventListener('click', () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); });
      wrap.querySelector('#cal-next').addEventListener('click', () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); });
      wrap.querySelector('#cal-today').addEventListener('click', () => { viewYear = now.getFullYear(); viewMonth = now.getMonth(); selectedDay = { d: now.getDate(), m: now.getMonth(), y: now.getFullYear() }; render(); });

      wrap.querySelectorAll('.cal-day:not(.other-month)').forEach(el => {
        el.addEventListener('click', () => {
          selectedDay = { d: parseInt(el.dataset.d), m: parseInt(el.dataset.m), y: parseInt(el.dataset.y) };
          render();
        });
      });

      const addBtn = wrap.querySelector('#cal-add-evt');
      if (addBtn && !addBtn.disabled) {
        addBtn.addEventListener('click', () => {
          const title = prompt('Event title:');
          if (!title) return;
          const time = prompt('Time (e.g. 14:00, or leave blank):', '') || '';
          const key = `${selectedDay.y}-${selectedDay.m}-${selectedDay.d}`;
          if (!events[key]) events[key] = [];
          events[key].push({ title, time });
          saveEvents();
          render();
        });
      }

      // Delete event buttons
      wrap.querySelectorAll('[data-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          const key = `${selectedDay.y}-${selectedDay.m}-${selectedDay.d}`;
          if (events[key]) { events[key].splice(idx, 1); if (!events[key].length) delete events[key]; }
          saveEvents(); render();
        });
      });
    };

    render();
    return wrap;
  }
};