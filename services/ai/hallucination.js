export function checkHallucinations(output, ctx) {
  const flags = [];
  const text = (output || "").toLowerCase();
  
  const whitelist = [
    ...(ctx.allergies || []).map(a => a.toLowerCase()),
    ...(ctx.medications || []).map(m => (m.name || "").toLowerCase())
  ];
  
  // naive: if it mentions 'penicillin' but not in context, flag (example)
  ["penicillin", "warfarin", "heparin", "insulin", "metformin"].forEach(term => {
    if (text.includes(term) && !whitelist.includes(term)) {
      flags.push({ 
        reason: `mentions ${term} not in context`, 
        span: term 
      });
    }
  });
  
  return flags;
}









