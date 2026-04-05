<script setup lang="ts">
import { useDashboardStore, WIDGET_REGISTRY } from '../../stores/dashboard.store.js';

const dash = useDashboardStore();

function isVisible(widgetId: string): boolean {
  return dash.layout.find(l => l.widgetId === widgetId)?.visible ?? false;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="catalog">
      <div v-if="dash.catalogOpen" class="catalog-backdrop" @click.self="dash.catalogOpen = false">
        <div class="catalog-panel">
          <div class="catalog-head">
            <h3 class="catalog-title">Widget-Katalog</h3>
            <button class="catalog-close" @click="dash.catalogOpen = false">&times;</button>
          </div>

          <p class="catalog-hint">Widgets ein-/ausblenden und per Drag & Drop anordnen.</p>

          <div class="catalog-list">
            <label
              v-for="w in WIDGET_REGISTRY"
              :key="w.id"
              class="catalog-item"
              :class="{ 'catalog-item--off': !isVisible(w.id) }"
            >
              <input
                type="checkbox"
                :checked="isVisible(w.id)"
                class="catalog-check"
                @change="dash.toggleWidget(w.id)"
              />
              <span class="catalog-icon">{{ w.icon }}</span>
              <div class="catalog-meta">
                <span class="catalog-label">{{ w.label }}</span>
                <span class="catalog-desc">{{ w.description }}</span>
              </div>
            </label>
          </div>

          <button class="catalog-reset" @click="dash.resetLayout()">
            Layout zurücksetzen
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.catalog-backdrop {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(0,0,0,.5);
  display: flex; justify-content: flex-end;
}
.catalog-panel {
  width: 360px; max-width: 90vw; height: 100%;
  background: var(--bg-surface); border-left: 1px solid var(--bg-border);
  padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4);
  overflow-y: auto;
}
.catalog-head { display: flex; align-items: center; justify-content: space-between; }
.catalog-title { font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); margin: 0; }
.catalog-close { font-size: 24px; color: var(--text-muted); cursor: pointer; background: none; border: none; line-height: 1; }
.catalog-close:hover { color: var(--text-secondary); }
.catalog-hint { font-size: var(--text-xs); color: var(--text-muted); }

.catalog-list { display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }
.catalog-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3); border-radius: var(--radius-md);
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  cursor: pointer; transition: all .15s;
}
.catalog-item:hover { border-color: var(--bg-border-hover); }
.catalog-item--off { opacity: .5; }
.catalog-check { accent-color: var(--accent); width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; }
.catalog-icon { font-size: 20px; flex-shrink: 0; }
.catalog-meta { flex: 1; min-width: 0; }
.catalog-label { display: block; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.catalog-desc { display: block; font-size: var(--text-xs); color: var(--text-muted); }

.catalog-reset {
  padding: var(--space-2) var(--space-4); border-radius: var(--radius-md);
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  color: var(--text-muted); font-size: var(--text-sm); cursor: pointer;
  transition: all .15s;
}
.catalog-reset:hover { color: var(--text-secondary); border-color: var(--bg-border-hover); }

/* Transitions */
.catalog-enter-active, .catalog-leave-active { transition: opacity .2s ease; }
.catalog-enter-active .catalog-panel, .catalog-leave-active .catalog-panel { transition: transform .25s ease; }
.catalog-enter-from, .catalog-leave-to { opacity: 0; }
.catalog-enter-from .catalog-panel { transform: translateX(100%); }
.catalog-leave-to .catalog-panel { transform: translateX(100%); }
</style>
