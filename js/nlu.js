// Natural Language Understanding - parse voice text into structured todo fields
import { getSettings } from './settings.js';
import { logVoiceEvent } from './voice/debugLog.js';

// Parse relative date expressions to YYYY-MM-DD
function parseDate(text) {
    const today = new Date();
    const lower = text.toLowerCase();
    const weekStartMonday = (date) => {
        const d = new Date(date);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - (day - 1));
        d.setHours(0, 0, 0, 0);
        return d;
    };
    const weekDayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };

    // Chinese date patterns
    if (/今天/.test(text)) return formatDate(today);
    if (/明天/.test(text)) return formatDate(addDays(today, 1));
    if (/后天/.test(text)) return formatDate(addDays(today, 2));
    if (/大后天/.test(text)) return formatDate(addDays(today, 3));

    // "本周X" / "这周X" / "本星期X"
    const cnThisWeekMatch = text.match(/[本这][周星期]+([一二三四五六日天])/);
    if (cnThisWeekMatch) {
        const targetDay = weekDayMap[cnThisWeekMatch[1]];
        if (targetDay) {
            const start = weekStartMonday(today);
            const target = addDays(start, targetDay - 1);
            if (target < today) return formatDate(addDays(target, 7));
            return formatDate(target);
        }
    }

    // "下周X" / "下星期X" — specific weekday next week (must check before generic 下周)
    const cnNextWeekMatch = text.match(/下[周星期]+([一二三四五六日天])/);
    if (cnNextWeekMatch) {
        const targetDay = weekDayMap[cnNextWeekMatch[1]];
        if (targetDay) {
            const start = addDays(weekStartMonday(today), 7);
            const target = addDays(start, targetDay - 1);
            return formatDate(target);
        }
    }

    if (/下周|下星期/.test(text)) return formatDate(addDays(today, 7));
    if (/下个月/.test(text)) {
        const d = new Date(today);
        d.setMonth(d.getMonth() + 1);
        return formatDate(d);
    }

    // Chinese: X天后, X天之后
    const cnDaysMatch = text.match(/(\d+)\s*天[后之]/);
    if (cnDaysMatch) return formatDate(addDays(today, parseInt(cnDaysMatch[1])));

    // Chinese: X月X日, X月X号
    const cnDateMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
    if (cnDateMatch) {
        const d = new Date(today.getFullYear(), parseInt(cnDateMatch[1]) - 1, parseInt(cnDateMatch[2]));
        if (d < today) d.setFullYear(d.getFullYear() + 1);
        return formatDate(d);
    }

    // English date patterns
    if (/\btoday\b/i.test(lower)) return formatDate(today);
    if (/\btomorrow\b/i.test(lower)) return formatDate(addDays(today, 1));
    if (/\bday after tomorrow\b/i.test(lower)) return formatDate(addDays(today, 2));
    if (/\bnext week\b/i.test(lower)) return formatDate(addDays(today, 7));
    if (/\bnext month\b/i.test(lower)) {
        const d = new Date(today);
        d.setMonth(d.getMonth() + 1);
        return formatDate(d);
    }

    // English: in X days
    const enDaysMatch = lower.match(/in\s+(\d+)\s+days?/i);
    if (enDaysMatch) return formatDate(addDays(today, parseInt(enDaysMatch[1])));

    // Weekday names (next occurrence)
    const weekdays = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
    const cnWeekdays = { '周一': 1, '星期一': 1, '周二': 2, '星期二': 2, '周三': 3, '星期三': 3, '周四': 4, '星期四': 4, '周五': 5, '星期五': 5, '周六': 6, '星期六': 6, '周日': 0, '星期日': 0, '星期天': 0 };

    for (const [name, day] of Object.entries(weekdays)) {
        if (lower.includes(name)) {
            const diff = (day - today.getDay() + 7) % 7 || 7;
            return formatDate(addDays(today, diff));
        }
    }
    for (const [name, day] of Object.entries(cnWeekdays)) {
        if (text.includes(name)) {
            const diff = (day - today.getDay() + 7) % 7 || 7;
            return formatDate(addDays(today, diff));
        }
    }

    return null;
}

function hasWeekdaySignal(text) {
    if (!text) return false;
    return /[本这下]周[一二三四五六日天]/.test(text)
        || /[本这下]星期[一二三四五六日天]/.test(text)
        || /周[一二三四五六日天]/.test(text)
        || /星期[一二三四五六日天]/.test(text)
        || /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);
}

// Parse priority from text
function parsePriority(text) {
    const lower = text.toLowerCase();

    // Explicit P0-P3
    if (/\bP0\b/i.test(text) || /紧急|非常紧急|urgent|critical|asap/i.test(lower) || /很急|特别急|马上/i.test(text)) return 'P0';
    if (/\bP1\b/i.test(text) || /重要|important|high priority/i.test(lower) || /比较急/i.test(text)) return 'P1';
    if (/\bP3\b/i.test(text) || /不急|不重要|low priority|whenever|有空/i.test(lower)) return 'P3';
    if (/\bP2\b/i.test(text)) return 'P2';

    return null; // default handled by caller
}

// Remove date/priority tokens from text to get clean task description
function cleanText(text) {
    let cleaned = text;

    // Remove Chinese date expressions
    cleaned = cleaned.replace(/今天|明天|后天|大后天/g, '');
    cleaned = cleaned.replace(/[本这下][周星期]+[一二三四五六日天]/g, '');
    cleaned = cleaned.replace(/下周|下星期|下个月/g, '');
    cleaned = cleaned.replace(/\d+\s*天[后之]/g, '');
    cleaned = cleaned.replace(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/g, '');
    cleaned = cleaned.replace(/周[一二三四五六日]|星期[一二三四五六日天]/g, '');

    // Remove English date expressions
    cleaned = cleaned.replace(/\b(today|tomorrow|day after tomorrow|next week|next month)\b/gi, '');
    cleaned = cleaned.replace(/\bin\s+\d+\s+days?\b/gi, '');
    cleaned = cleaned.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');

    // Remove priority keywords
    cleaned = cleaned.replace(/\bP[0-3]\b/gi, '');
    cleaned = cleaned.replace(/紧急|非常紧急|很急|特别急|马上|比较急|不急|不重要|有空/g, '');
    cleaned = cleaned.replace(/\b(urgent|critical|asap|important|high priority|low priority|whenever)\b/gi, '');

    // Remove leading conjunctions/filler
    cleaned = cleaned.replace(/^[，,、。.：:；;\s]+/, '');
    cleaned = cleaned.replace(/[，,、。.：:；;\s]+$/, '');

    // Remove common voice prefixes
    cleaned = cleaned.replace(/^(帮我|提醒我|记一下|添加|新建|创建一个?|add|remind me to|create|make a note to)\s*/i, '');

    return cleaned.trim();
}

function isInstructionOnlyCorrection(text) {
    const normalized = (text || '').trim();
    if (!normalized) return false;
    return /^(你前面|前面|刚才|刚刚|上一句|上句话|上条|这句|刚识别|你识别).*(有误|有错|错了|拼写|别字|不对|改一下|改成|改为)/.test(normalized)
        || /^(纠正一下|修正一下|改一下|修改一下)/.test(normalized)
        || /^(that|the)\s+(spelling|wording)\s+(is|was)\s+(wrong|incorrect)/i.test(normalized)
        || /^fix\s+the\s+(spelling|wording)/i.test(normalized);
}

function applyLocalCorrection(existingText, instructionText) {
    const current = (existingText || '').trim();
    const instruction = (instructionText || '').trim();
    if (!current || !instruction) return null;

    const cnReplace = instruction.match(/把(.+?)改(?:成|为)(.+)$/);
    if (cnReplace) {
        const from = cnReplace[1].trim().replace(/^["'“”‘’]/, '').replace(/["'“”‘’]$/, '');
        const to = cnReplace[2].trim().replace(/^["'“”‘’]/, '').replace(/["'“”‘’]$/, '');
        if (from && to && current.includes(from)) {
            return current.replace(from, to);
        }
    }

    const enReplace = instruction.match(/replace\s+["']?(.+?)["']?\s+with\s+["']?(.+?)["']?$/i);
    if (enReplace) {
        const from = enReplace[1].trim();
        const to = enReplace[2].trim();
        if (from && to && current.toLowerCase().includes(from.toLowerCase())) {
            const idx = current.toLowerCase().indexOf(from.toLowerCase());
            return current.slice(0, idx) + to + current.slice(idx + from.length);
        }
    }

    return null;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDate(date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Parse with OpenAI GPT for better understanding
async function parseWithLLM(text, settings, existingContext) {
    if (!settings.openaiApiKey) return null;

    const today = formatDate(new Date());
    let prompt;

    if (existingContext && existingContext.text) {
        // Merge mode: user is refining an existing task
        prompt = `You are a task parser. The user is building a to-do item using voice input, possibly across multiple rounds.

Today's date: ${today}
Week starts on Monday. Interpret "本周/这周/下周" relative to the local date above.

Current task state:
- text: "${existingContext.text}"
- priority: "${existingContext.priority || 'P2'}"
- eta: "${existingContext.eta || 'not set'}"

The user just said: "${text}"

Determine the user's intent:
- If the new input CORRECTS or REPLACES part of the existing text, update it accordingly.
- If the new input ADDS new information not covered before, merge it with the existing text.
- If the new input only provides a date or priority, keep the existing text unchanged.
- If the new input is only meta-guidance about recognition quality (e.g. "前面哪个字错了", "有拼写错误", "纠正一下"), DO NOT include that guidance in task text; keep text unchanged unless it provides explicit replacement content.
- Extract any priority or date information from the new input.

Return ONLY a JSON object:
- "text": the final merged/corrected task description
- "priority": one of "P0","P1","P2","P3", or null if not mentioned in the NEW input
- "eta": deadline as "YYYY-MM-DD" if mentioned in the NEW input, or null
- "textChanged": true if you modified the text field, false if text stays the same`;
    } else {
        prompt = `You are a task parser. Extract structured data from the user's voice input.

Today's date: ${today}
Week starts on Monday. Interpret "本周/这周/下周" relative to the local date above.

User said: "${text}"

Return ONLY a JSON object with these fields:
- "text": the clean task description (remove date/priority words, keep the core task)
- "priority": one of "P0" (urgent), "P1" (high), "P2" (medium/default), "P3" (low), or null if unclear
- "eta": deadline as "YYYY-MM-DD" if mentioned, or null

Example: "明天提醒我开会，比较急" → {"text":"开会","priority":"P1","eta":"${formatDate(addDays(new Date(), 1))}"}`;
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: settings.openaiModel || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.1,
                max_tokens: 200,
            }),
            signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) return null;

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            logVoiceEvent('nlu.llm.timeout');
            return null;
        }
        logVoiceEvent('nlu.llm.error', { message: e.message });
        console.error('LLM parsing failed:', e);
    }
    return null;
}

// Main NLU function: parse voice text into todo fields
// existingContext: { text, priority, eta } — current form state for incremental updates
export async function parseVoiceInput(text, existingContext) {
    logVoiceEvent('nlu.parse.start', { chars: text?.length || 0, hasContext: Boolean(existingContext) });
    const settings = getSettings();

    // Try LLM parsing first if OpenAI key is available
    if (settings.openaiApiKey && settings.voiceProvider === 'openai') {
        const llmResult = await parseWithLLM(text, settings, existingContext);
        if (llmResult) {
            const localEta = parseDate(text);
            const eta = (hasWeekdaySignal(text) && localEta) ? localEta : (llmResult.eta || null);
            logVoiceEvent('nlu.parse.llm.success');
            return {
                text: llmResult.text || (existingContext?.text) || text,
                priority: llmResult.priority || null,
                priorityExplicit: llmResult.priority != null,
                eta,
                textChanged: llmResult.textChanged !== false,
            };
        }
    }

    if (existingContext?.text) {
        if (isInstructionOnlyCorrection(text)) {
            logVoiceEvent('nlu.parse.local.instruction_only');
            return {
                text: existingContext.text,
                priority: null,
                priorityExplicit: false,
                eta: null,
                textChanged: false,
            };
        }

        const corrected = applyLocalCorrection(existingContext.text, text);
        if (corrected && corrected !== existingContext.text) {
            logVoiceEvent('nlu.parse.local.correction_applied');
            return {
                text: corrected,
                priority: null,
                priorityExplicit: false,
                eta: null,
                textChanged: true,
            };
        }
    }

    // Fallback: local keyword parsing
    const eta = parseDate(text);
    const priority = parsePriority(text);
    const cleanedText = cleanText(text);
    logVoiceEvent('nlu.parse.local.success');

    return {
        text: cleanedText || text,
        priority: priority || 'P2',
        priorityExplicit: priority != null,
        eta: eta,
        textChanged: true,
    };
}
