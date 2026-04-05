<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useGotifyStore } from '../../stores/gotify.store.js';

const router = useRouter();
const gotify = useGotifyStore();

function nav(r: string) { router.push(r); }
function fmtDate(iso?: string): string { if (!iso) return ''; return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }
</script>

<template>
  <div class="gotify-widget">
    <div class="widget-head">
      <span class="widget-title">Benachrichtigungen</span>
      <button class="wlink" @click="nav('/gotify')">Alle ›</button>
    </div>
    <div v-if="!gotify.configured" class="w-empty">Gotify nicht konfiguriert</div>
    <div v-else-if="!gotify.messages.length" class="w-empty">Keine Nachrichten</div>
    <div v-else class="gotify-list">
      <div v-for="msg in gotify.messages.slice(0,5)" :key="msg.id" class="gotify-row" :class="msg.priority>=8?'g-crit':msg.priority>=5?'g-high':''">
        <div class="g-prio" :title="`Priorität ${msg.priority}`">
          <span v-if="msg.priority>=8">&#x1f534;</span>
          <span v-else-if="msg.priority>=5">&#x1f7e1;</span>
          <span v-else>&#x1f535;</span>
        </div>
        <div class="g-body">
          <p class="g-title">{{ msg.title }}</p>
          <p class="g-msg">{{ msg.message }}</p>
        </div>
        <span class="g-date">{{ fmtDate(msg.date) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gotify-widget { display: flex; flex-direction: column; gap: var(--space-3); }
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.wlink { font-size: var(--text-xs); color: var(--text-muted); transition: color .15s; }
.wlink:hover { color: var(--text-secondary); }
.w-empty { font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-3) 0; }
.gotify-list { display: flex; flex-direction: column; gap: 2px; }
.gotify-row  { display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm); }
.gotify-row.g-crit { border-left: 2px solid #ef4444; }
.gotify-row.g-high { border-left: 2px solid #f59e0b; }
.g-prio  { flex-shrink: 0; font-size: 12px; line-height: 1.5; }
.g-body  { flex: 1; min-width: 0; }
.g-title { font-size: 11px; color: var(--text-secondary); font-weight: 600; margin: 0 0 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-msg   { font-size: 10px; color: var(--text-muted); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-date  { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
</style>
