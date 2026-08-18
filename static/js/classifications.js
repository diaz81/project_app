// Manual classification an inspector assigns to a point. Keys must match
// CLASSIFICATION_CHOICES in models.py and the <select> options in
// templates/inspector.html.
export const CLASSIFICATIONS = {
  registrado: { emoji: "🟢", label: "Registrado", color: 0x2ecc71 },
  observacion: { emoji: "🟡", label: "Observación", color: 0xf1c40f },
  diferencia_significativa: { emoji: "🟠", label: "Diferencia significativa", color: 0xe67e22 },
  evaluacion_adicional: { emoji: "🔴", label: "Evaluación adicional recomendada", color: 0xe74c3c },
  sin_referencia: { emoji: "⚪", label: "Sin referencia", color: 0xbdbdbd },
};

const FALLBACK_COLOR = 0xffc107;

export function classificationColor(key) {
  return CLASSIFICATIONS[key] ? CLASSIFICATIONS[key].color : FALLBACK_COLOR;
}

export function classificationLabel(key) {
  const c = CLASSIFICATIONS[key];
  return c ? `${c.emoji} ${c.label}` : "—";
}
