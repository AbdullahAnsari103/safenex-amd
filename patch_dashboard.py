"""
Patch dashboard.html:
1. Replace ACTIVE MODULES section with enhanced version
2. Remove id-section from id-system-row (keep system panel, make it full-width)
"""

filepath = r'c:\Users\abdul\OneDrive\Desktop\trialsafex\public\dashboard.html'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Replace ACTIVE MODULES section ─────────────────────────────────────
old_modules_start = content.find('        <!-- ACTIVE MODULES -->')
old_modules_end   = content.find('\n        <!-- IDENTITY + SYSTEM')
if old_modules_start < 0:
    old_modules_start = content.find('<!-- ACTIVE MODULES -->')
    old_modules_end   = content.find('<!-- IDENTITY + SYSTEM')

print(f"Modules: start={old_modules_start}, end={old_modules_end}")

new_modules = '''        <!-- ACTIVE MODULES -->
        <section class="section modules-section" id="modules" aria-label="Active Modules">
            <div class="section__header">
                <h2 class="section__title">ACTIVE MODULES</h2>
                <div class="modules-header-meta">
                    <span class="modules-online-count"><span id="onlineCount">2</span> of 3 Online</span>
                </div>
            </div>

            <div class="modules-grid-v2">

                <!-- SafeTrace -->
                <article class="mod-card mod-card--blue" tabindex="0" role="button" aria-label="SafeTrace module — Online. Launch to open.">
                    <div class="mod-card__bg-glow" aria-hidden="true"></div>
                    <div class="mod-card__inner">
                        <div class="mod-card__top">
                            <div class="mod-card__icon mod-card__icon--blue">
                                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v2M12 16v2M6 12H4M20 12h-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                            </div>
                            <span class="mod-badge mod-badge--online">
                                <span class="mod-badge__dot"></span>ONLINE
                            </span>
                        </div>

                        <h3 class="mod-card__title">SafeTrace</h3>
                        <p class="mod-card__desc">Risk-aware route navigation across active urban zones using live threat data.</p>

                        <div class="mod-card__stats">
                            <div class="mod-stat">
                                <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5"/></svg>
                                <span>3 Active Zones</span>
                            </div>
                            <div class="mod-stat">
                                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                                <span>Live Updates</span>
                            </div>
                        </div>

                        <div class="mod-card__progress">
                            <div class="mod-card__progress-label"><span>Route Safety Score</span><span>94%</span></div>
                            <div class="mod-card__bar"><div class="mod-card__bar-fill mod-card__bar-fill--blue" style="width:94%"></div></div>
                        </div>

                        <button class="mod-card__btn mod-card__btn--blue" aria-label="Launch SafeTrace module">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            Launch SafeTrace
                        </button>
                    </div>
                </article>

                <!-- Silent Room -->
                <article class="mod-card mod-card--cyan" tabindex="0" role="button" aria-label="Silent Room module — Online. Enter to open.">
                    <div class="mod-card__bg-glow" aria-hidden="true"></div>
                    <div class="mod-card__inner">
                        <div class="mod-card__top">
                            <div class="mod-card__icon mod-card__icon--cyan">
                                <svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                            </div>
                            <span class="mod-badge mod-badge--online">
                                <span class="mod-badge__dot"></span>ONLINE
                            </span>
                        </div>

                        <h3 class="mod-card__title">Silent Room</h3>
                        <p class="mod-card__desc">Community safety reporting hub with acoustic anomaly detection and silent alerts.</p>

                        <div class="mod-card__stats">
                            <div class="mod-stat">
                                <svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5"/></svg>
                                <span>12 Reports Today</span>
                            </div>
                            <div class="mod-stat">
                                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                                <span>Real-time Feed</span>
                            </div>
                        </div>

                        <div class="mod-card__progress">
                            <div class="mod-card__progress-label"><span>Community Trust</span><span>87%</span></div>
                            <div class="mod-card__bar"><div class="mod-card__bar-fill mod-card__bar-fill--cyan" style="width:87%"></div></div>
                        </div>

                        <button class="mod-card__btn mod-card__btn--cyan" aria-label="Enter Silent Room module">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            Enter Silent Room
                        </button>
                    </div>
                </article>

                <!-- Nexa AI SOS -->
                <article class="mod-card mod-card--red mod-card--sos" tabindex="0" role="button" aria-label="Nexa AI SOS — Standby. Activate for emergency.">
                    <div class="mod-card__bg-glow" aria-hidden="true"></div>
                    <div class="mod-card__inner">
                        <div class="mod-card__top">
                            <div class="mod-card__icon mod-card__icon--red">
                                <svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </div>
                            <span class="mod-badge mod-badge--standby">
                                <span class="mod-badge__dot mod-badge__dot--standby"></span>STANDBY
                            </span>
                        </div>

                        <h3 class="mod-card__title">Nexa AI SOS</h3>
                        <p class="mod-card__desc">AI-powered emergency detection — broadcasts your location and triggers instant response.</p>

                        <div class="mod-card__stats">
                            <div class="mod-stat">
                                <svg viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span>Response &lt; 3 sec</span>
                            </div>
                            <div class="mod-stat">
                                <svg viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.8 12.8 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.8 12.8 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" stroke-width="1.5"/></svg>
                                <span>Auto-Alert Contacts</span>
                            </div>
                        </div>

                        <div class="mod-card__sos-pulse" aria-hidden="true">
                            <div class="mod-card__sos-ring mod-card__sos-ring--1"></div>
                            <div class="mod-card__sos-ring mod-card__sos-ring--2"></div>
                            <div class="mod-card__sos-ring mod-card__sos-ring--3"></div>
                        </div>

                        <button class="mod-card__btn mod-card__btn--sos" aria-label="Activate Nexa AI SOS emergency system">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            Activate SOS
                        </button>
                    </div>
                </article>

            </div>
        </section>

'''

content = content[:old_modules_start] + new_modules + content[old_modules_end:]

print(f"After modules replacement: length={len(content)}")

# ─── 2. Remove id-section, keep system-panel full width ─────────────────────
# Find id-system-row start
isrow_start = content.find('        <!-- IDENTITY + SYSTEM')
if isrow_start < 0:
    isrow_start = content.find('<!-- IDENTITY + SYSTEM')

# Find the end of id-system-row block (before RECENT ACTIVITY)
recent_start = content.find('        <!-- RECENT ACTIVITY')
if recent_start < 0:
    recent_start = content.find('<!-- RECENT ACTIVITY')

print(f"id-system-row: start={isrow_start}, recent_start={recent_start}")

# Get the id-system-row block
block = content[isrow_start:recent_start]

# Find system-panel section within the block
sp_start = block.find('<section class="system-panel"')
sp_end_marker = '</section>\n\n        </div>'  
sp_end = block.find('</section>', sp_start) + len('</section>')
system_panel_html = block[sp_start:sp_end]

print(f"system-panel found: {sp_start >= 0}, length={len(system_panel_html)}")

# Replace entire id-system-row with just the system panel (no wrapper)
new_identity_section = f'''        <!-- SYSTEM STATUS -->
        <div id="identity">
{system_panel_html}
        </div>

        '''

content = content[:isrow_start] + new_identity_section + content[recent_start:]
print(f"Final length: {len(content)}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open(filepath, 'r', encoding='utf-8') as f:
    v = f.read()
print(f"Has mod-card--blue: {'mod-card--blue' in v}")
print(f"Has id-section removed: {'id-section' not in v}")
print(f"Has system-panel: {'system-panel' in v}")
