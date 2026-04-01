<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  cancelLabel?: string;
}>(), {
  confirmLabel: 'Löschen',
  confirmColor: '#ef4444',
  cancelLabel: 'Abbrechen',
});

const emit = defineEmits<{
  'update:modelValue': [v: boolean];
  confirm: [];
  cancel: [];
}>();

function onCancel() { emit('cancel'); emit('update:modelValue', false); }
function onConfirm() { emit('confirm'); emit('update:modelValue', false); }
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="cd-backdrop" @click.self="onCancel">
      <div class="cd-dialog">
        <div class="cd-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </div>
        <h2 class="cd-title">{{ title }}</h2>
        <p class="cd-msg">{{ message }}</p>
        <div class="cd-actions">
          <button class="cd-cancel" @click="onCancel">{{ cancelLabel }}</button>
          <button class="cd-confirm" :style="{ background: confirmColor, borderColor: confirmColor }" @click="onConfirm">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cd-backdrop {
  position: fixed; inset: 0; z-index: 99998;
  background: rgba(0,0,0,.75); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.cd-dialog {
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  border-radius: var(--radius-xl); padding: var(--space-6);
  width: 360px; max-width: 90vw;
  display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
  box-shadow: 0 24px 64px rgba(0,0,0,.85);
  animation: cd-in .15s ease;
}
@keyframes cd-in { from { opacity:0; transform:scale(.94) translateY(8px); } to { opacity:1; transform:none; } }
.cd-icon {
  width: 48px; height: 48px; border-radius: 50%;
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.2);
  display: flex; align-items: center; justify-content: center; color: #ef4444;
}
.cd-title { font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); margin: 0; text-align: center; }
.cd-msg { font-size: var(--text-sm); color: var(--text-muted); margin: 0; text-align: center; line-height: 1.6; }
.cd-actions { display: flex; gap: var(--space-3); width: 100%; margin-top: var(--space-2); }
.cd-cancel, .cd-confirm { flex: 1; padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: all .15s; }
.cd-cancel { background: var(--bg-overlay); border: 1px solid var(--bg-border); color: var(--text-secondary); }
.cd-cancel:hover { background: var(--bg-surface); color: var(--text-primary); }
.cd-confirm { color: #fff; border: 1px solid; }
.cd-confirm:hover { filter: brightness(1.15); }
</style>
