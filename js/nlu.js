// Natural Language Understanding - parse voice text into structured todo fields
import { getSettings } from './settings.js';

// Parse relative date expressions to YYYY-MM-DD
function parseDate(text) {
    const today = new Date();
    const lower = text.toLowerCase();

    // Chinese date patterns
    if (/今天/.test(text)) return formatDate(today);
    if (/明天/.test(text)) return formatDate(addDays(today, 1));
    if (/后天/.test(text)) return formatDate(addDays(today, 2));
    if (/大后天/.test(text)) return formatDate(addDays(today, 3));

    // "下周X" / "下星期X" — specific weekday next week (must check before generic 下周)
    const cnNextWeekdayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
    const cnNextWeekMatch = text.match(/下[周星期]+([一二三四五六日天])/);
    if (cnNextWeekMatch) {
        const targetDay = cnNextWeekdayMap[cnNextWeekMatch[1]];
        if (targetDay !== undefined) {
            // Next week's specific day: advance to next week then find the day
            const diff = (targetDay - today.getDay() + 7) % 7 || 7;
            return formatDate(addDays(today, diff));
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
    cleaned = cleaned.replace(/下[周星期]+[一二三四五六日天]/g, '');
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

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Parse with OpenAI GPT for better understanding
async function parseWithLLM(text, settings) {
    if (!settings.openaiApiKey) return null;

    const today = new Date().toISOString().split('T')[0];
    const prompt = `You are a task parser. Extract structured data from the user's voice input.

Today's date: ${today}

User said: "${text}"

Return ONLY a JSON object with these fields:
- "text": the clean task description (remove date/priority words, keep the core task)
- "priority": one of "P0" (urgent), "P1" (high), "P2" (medium/default), "P3" (low), or null if unclear
- "eta": deadline as "YYYY-MM-DD" if mentioned, or null

Example: "明天提醒我开会，比较急" → {"text":"开会","priority":"P1","eta":"${formatDate(addDays(new Date(), 1))}"}`;

    try {
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
        });

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
        console.error('LLM parsing failed:', e);
    }
    return null;
}

// Main NLU function: parse voice text into todo fields
export async function parseVoiceInput(text) {
    const settings = getSettings();

    // Try LLM parsing first if OpenAI key is available
    if (settings.openaiApiKey && settings.voiceProvider === 'openai') {
        const llmResult = await parseWithLLM(text, settings);
        if (llmResult && llmResult.text) {
            return {
                text: llmResult.text,
                priority: llmResult.priority || 'P2',
                eta: llmResult.eta || null,
            };
        }
    }

    // Fallback: local keyword parsing
    const eta = parseDate(text);
    const priority = parsePriority(text);
    const cleanedText = cleanText(text);

    return {
        text: cleanedText || text,
        priority: priority || 'P2',
        eta: eta,
    };
}
