// Manual classification an inspector assigns to a point. Keys must match
// CLASSIFICATION_CHOICES in models.py and the <select> options in
// templates/inspector.html.
// labelEn is used only by the (English) client view; the Inspector view
// keeps using `label` (Spanish) via classificationLabel(), unchanged.
export const CLASSIFICATIONS = {
  registrado: { emoji: "🟢", label: "Registrado", labelEn: "Registered", color: 0x2ecc71 },
  observacion: { emoji: "🟡", label: "Observación", labelEn: "Observation", color: 0xf1c40f },
  diferencia_significativa: {
    emoji: "🟠",
    label: "Diferencia significativa",
    labelEn: "Significant difference",
    color: 0xe67e22,
  },
  evaluacion_adicional: {
    emoji: "🔴",
    label: "Evaluación adicional recomendada",
    labelEn: "Additional evaluation recommended",
    color: 0xe74c3c,
  },
  sin_referencia: { emoji: "⚪", label: "Sin referencia", labelEn: "No reference", color: 0xbdbdbd },
};

const FALLBACK_COLOR = 0xffc107;

export function classificationColor(key) {
  return CLASSIFICATIONS[key] ? CLASSIFICATIONS[key].color : FALLBACK_COLOR;
}

export function classificationLabel(key) {
  const c = CLASSIFICATIONS[key];
  return c ? `${c.emoji} ${c.label}` : "—";
}

export function classificationLabelEn(key) {
  const c = CLASSIFICATIONS[key];
  return c ? `${c.emoji} ${c.labelEn}` : "—";
}
