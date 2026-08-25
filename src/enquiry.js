// ════════════════════════════════════════════════════════════════════
//  予約・お問い合わせの受け口
//
//  この機能を作り直した理由は、元のフォームが **何も送っていないのに
//  「✓ お問い合わせを送信しました。担当者よりご連絡いたします」を必ず
//  表示していた** から。実予約を受けるサイトでそれをやると、お客様が
//  予約が通ったと信じて待つ。だからここでは順序と出し分けを厳密にする。
//
//    1. Turnstile を検証する (bot 対策はここだけに任せ、IP は保存しない)
//    2. **D1 に保存する** — メールより先。送信が失敗しても記録は残す
//    3. メールを送る
//    4. **3 の結果を画面に正直に返す**
//
//  env.EMAIL.send() の ok は「Cloudflare が受け取った」であって
//  「届いた」ではない (存在しないドメイン宛でも ok が返り、後から bounce)。
//  それでも「送信の呼び出しが失敗した」ことは分かるので、そこは必ず出す。
//
//  宛先 (ENQUIRY_TO) が未設定のうちはフォーム自体を出さない (fail-closed)。
//  誰も見ない場所に問い合わせを溜めるのは、消えるのと同じくらい悪い。
// ════════════════════════════════════════════════════════════════════

import { ROOMS, ROOM_ORDER } from './rooms.js';

const FROM = 'noreply@gensuirou.com';
const FROM_NAME = '源翠瓏 Gensuirou';
const REPLY_FROM = 'reservation@gensuirou.com';
const TEL_DISPLAY = '+81 (0)96-279-1800';

/** フォームを出せる状態か。宛先が無いなら出さない。 */
export const enquiryEnabled = (env) => !!(env && env.ENQUIRY_TO && env.TURNSTILE_SITEKEY);

const LIMITS = {
  name: 120, email: 160, phone: 60, country: 80,
  checkin: 20, nights: 10, guests: 10, villa: 40, message: 4000,
};

const validEmail = (s) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(s);

const MSG = {
  sent: {
    ja: 'お問い合わせを受け付けました。担当者よりご連絡いたします。',
    en: 'Your enquiry has been received. A member of our staff will be in touch.',
    zh: '已收到您的咨询。我们的工作人员将与您联络。',
  },
  // 保存はできたが通知が出せなかった。旅館の目に触れない可能性があるので、
  // 「送れた」とは絶対に書かない。
  notNotified: {
    ja: `送信を受け付けましたが、係へのお知らせに失敗いたしました。恐れ入りますが、お電話（${TEL_DISPLAY}）にてご連絡くださいませ。`,
    en: `We received your message, but could not notify our staff. Please call us on ${TEL_DISPLAY}.`,
    zh: `已收到您的信息，但未能通知工作人员。烦请致电 ${TEL_DISPLAY}。`,
  },
  invalid: {
    ja: '入力内容をご確認くださいませ。',
    en: 'Please check the details you entered.',
    zh: '请确认您填写的内容。',
  },
  bot: {
    ja: '確認に失敗いたしました。お手数ですが、もう一度お試しくださいませ。',
    en: 'Verification failed. Please try again.',
    zh: '验证失败，请再试一次。',
  },
  duplicate: {
    ja: '先ほどのお問い合わせを承っております。重ねての送信は不要です。',
    en: 'We already have your enquiry from a moment ago. No need to send it again.',
    zh: '我们已收到您刚才的咨询，无需重复发送。',
  },
  error: {
    ja: `送信できませんでした。恐れ入りますが、お電話（${TEL_DISPLAY}）にてご連絡くださいませ。`,
    en: `We could not send your enquiry. Please call us on ${TEL_DISPLAY}.`,
    zh: `未能发送咨询。烦请致电 ${TEL_DISPLAY}。`,
  },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
  });

/** POST /api/enquiry */
export async function handleEnquiry(request, env, ctx) {
  if (request.method !== 'POST') return json({ ok: false, code: 'method' }, 405);

  // ⚠ 応答を返す前に body を読み切る。waitUntil の中で後から request.text()
  //    を呼ぶと、client が切れた瞬間に黙って空になる。
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, code: 'invalid', message: MSG.invalid }, 400);
  }

  const get = (k) => String(form.get(k) || '').trim().slice(0, LIMITS[k] || 200);
  const lang = ['ja', 'en', 'zh'].includes(get('lang')) ? get('lang') : 'ja';
  const pick = (m) => m[lang];

  if (!enquiryEnabled(env)) {
    // フォームを出していない状態で叩かれた。設定漏れを黙って飲まない。
    return json({ ok: false, code: 'disabled', message: pick(MSG.error) }, 503);
  }

  // ── 1. Turnstile ──
  const token = String(form.get('cf-turnstile-response') || '');
  const passed = await verifyTurnstile(token, env, request);
  if (!passed) return json({ ok: false, code: 'bot', message: pick(MSG.bot) }, 400);

  // ── 2. 入力の検証 ──
  const name = get('name');
  const email = get('email');
  if (!name || !validEmail(email)) {
    return json({ ok: false, code: 'invalid', message: pick(MSG.invalid) }, 400);
  }
  const villa = ROOM_ORDER.includes(get('villa')) ? get('villa') : '';

  const rec = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    lang,
    name,
    email,
    phone: get('phone'),
    country: get('country'),
    checkin: get('checkin'),
    nights: get('nights'),
    guests: get('guests'),
    villa,
    message: get('message'),
    cf_country: (request.cf && request.cf.country) || '',
  };

  // 同じアドレスからの連投を弾く。二重送信でスタッフに 2 通届くのを防ぐだけで、
  // bot 対策ではない (それは Turnstile の仕事)。
  try {
    const dup = await env.DB.prepare(
      `SELECT 1 AS x FROM enquiries WHERE email = ?1 AND created_at > ?2 LIMIT 1`,
    ).bind(email, new Date(Date.now() - 60_000).toISOString()).first();
    if (dup) return json({ ok: true, notified: true, code: 'duplicate', message: pick(MSG.duplicate) });
  } catch { /* 判定できなければ通す。弾くより通すほうが害が小さい */ }

  // ── 3. 保存 (メールより先) ──
  try {
    await env.DB.prepare(
      `INSERT INTO enquiries
        (id, created_at, lang, name, email, phone, country, checkin, nights, guests, villa, message, cf_country, mail_status)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'pending')`,
    ).bind(
      rec.id, rec.created_at, rec.lang, rec.name, rec.email, rec.phone, rec.country,
      rec.checkin, rec.nights, rec.guests, rec.villa, rec.message, rec.cf_country,
    ).run();
  } catch (e) {
    // 保存できないなら受け付けたと言ってはいけない。
    console.log('[enquiry] insert failed', String(e).slice(0, 200));
    return json({ ok: false, code: 'store', message: pick(MSG.error) }, 500);
  }

  // ── 4. 通知 ──
  const notify = await sendNotification(env, rec);
  ctx.waitUntil(
    env.DB.prepare(`UPDATE enquiries SET mail_status = ?1, mail_error = ?2 WHERE id = ?3`)
      .bind(notify.ok ? 'sent' : 'failed', notify.reason || null, rec.id).run()
      .catch(() => {}),
  );

  if (!notify.ok) {
    console.log('[enquiry] notify failed', rec.id, notify.reason);
    return json({ ok: true, notified: false, id: rec.id, message: pick(MSG.notNotified) });
  }

  // お客様への自動返信は、旅館への通知が通ってから。順序を逆にすると
  // 「控えは届いたのに旅館には伝わっていない」が起きる。
  ctx.waitUntil(sendAutoReply(env, rec).catch(() => {}));
  return json({ ok: true, notified: true, id: rec.id, message: pick(MSG.sent) });
}

async function verifyTurnstile(token, env, request) {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET);
  body.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.append('remoteip', ip);   // 検証に渡すだけ。保存はしない
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const d = await r.json();
    if (!d.success) console.log('[turnstile]', JSON.stringify(d['error-codes'] || []));
    return !!d.success;
  } catch (e) {
    // 検証できないときは通さない。ここを通すと Turnstile を置いた意味が消える。
    console.log('[turnstile] verify error', String(e).slice(0, 120));
    return false;
  }
}

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function notificationBody(rec) {
  const villa = rec.villa ? `${ROOMS[rec.villa].kanji} ${ROOMS[rec.villa].roman}` : '（指定なし）';
  const rows = [
    ['お名前', rec.name],
    ['メール', rec.email],
    ['電話', rec.phone],
    ['国／地域', rec.country],
    ['チェックイン希望', rec.checkin],
    ['宿泊日数', rec.nights],
    ['人数', rec.guests],
    ['ご希望の客室', villa],
    ['表示言語', rec.lang],
    ['接続元', rec.cf_country],
  ].filter(([, v]) => v);

  const text = [
    'サイトのフォームからお問い合わせがありました。',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    '── お問い合わせ内容 ──',
    rec.message || '（記載なし）',
    '',
    `受付 ID: ${rec.id}`,
    `受付日時: ${rec.created_at} (UTC)`,
    '',
    'このメールにそのまま返信すると、お客様宛に届きます。',
  ].join('\n');

  const html = `<div style="font-family:-apple-system,'Hiragino Mincho ProN','Noto Serif JP',serif;font-size:15px;line-height:1.9;color:#1c1a17">
<p>サイトのフォームからお問い合わせがありました。</p>
<table style="border-collapse:collapse;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#7a736a;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join('\n')}
</table>
<p style="margin-top:18px;color:#7a736a">お問い合わせ内容</p>
<p style="white-space:pre-wrap;border-left:3px solid #d9cfbe;padding-left:12px;margin:0">${esc(rec.message || '（記載なし）')}</p>
<p style="font-size:12px;color:#9b938a;margin-top:20px">受付 ID ${esc(rec.id)}／${esc(rec.created_at)} UTC<br>
このメールにそのまま返信すると、お客様宛に届きます。</p>
</div>`;
  const subject = `【サイト】お問い合わせ — ${rec.name} 様${rec.villa ? `（${villa}）` : ''}`;
  return { subject, text, html };
}

async function sendNotification(env, rec) {
  if (!env.EMAIL || typeof env.EMAIL.send !== 'function') return { ok: false, reason: 'no-binding' };
  if (!env.ENQUIRY_TO) return { ok: false, reason: 'no-recipient' };
  const { subject, text, html } = notificationBody(rec);
  try {
    await env.EMAIL.send({
      to: env.ENQUIRY_TO,
      from: { email: FROM, name: FROM_NAME },
      // 返信ボタンでそのままお客様に返せるようにする。
      // ⚠ from をお客様のアドレスにしてはいけない (SPF/DKIM で落ちる)。
      replyTo: rec.email,
      subject, text, html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e).slice(0, 200) };
  }
}

const AUTO = {
  ja: {
    subject: '【源翠瓏】お問い合わせを承りました',
    lead: 'このたびはお問い合わせをいただき、誠にありがとうございます。',
    // 返信の速さは約束しない (design.md の非交渉項目)。
    body: '内容を確認のうえ、担当者よりご連絡いたします。\nお急ぎの場合は、お電話にてご連絡くださいませ。',
    yours: 'お問い合わせ内容',
  },
  en: {
    subject: 'Gensuirou — we have received your enquiry',
    lead: 'Thank you for writing to us.',
    body: 'A member of our staff will read your message and be in touch.\nIf your enquiry is urgent, please call us.',
    yours: 'Your message',
  },
  zh: {
    subject: '【源翠瓏】已收到您的咨询',
    lead: '感谢您的来信。',
    body: '我们的工作人员确认内容后将与您联络。\n如有急事，敬请致电。',
    yours: '您的咨询内容',
  },
};

async function sendAutoReply(env, rec) {
  if (!env.EMAIL || typeof env.EMAIL.send !== 'function') return;
  const t = AUTO[rec.lang] || AUTO.ja;
  const text = [t.lead, '', t.body, '', `── ${t.yours} ──`, rec.message || '', '',
    '源翠瓏 Gensuirou', `TEL ${TEL_DISPLAY}`, 'https://gensuirou.com/'].join('\n');
  const html = `<div style="font-family:-apple-system,'Hiragino Mincho ProN','Noto Serif JP',serif;font-size:15px;line-height:1.9;color:#1c1a17">
<p>${esc(t.lead)}</p>
<p style="white-space:pre-line">${esc(t.body)}</p>
<p style="margin-top:18px;color:#7a736a">${esc(t.yours)}</p>
<p style="white-space:pre-wrap;border-left:3px solid #d9cfbe;padding-left:12px;margin:0">${esc(rec.message || '')}</p>
<hr style="border:none;border-top:1px solid #e6e0d6;margin:22px 0">
<p style="font-size:13px;color:#7a736a">源翠瓏 Gensuirou<br>TEL ${esc(TEL_DISPLAY)}<br>
<a href="https://gensuirou.com/" style="color:#7a736a">gensuirou.com</a></p>
</div>`;
  await env.EMAIL.send({
    to: rec.email,
    from: { email: REPLY_FROM, name: FROM_NAME },
    replyTo: env.ENQUIRY_TO,
    subject: t.subject, text, html,
  });
}
