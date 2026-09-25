/**
 * Language — the one owner of which words the interface uses.
 *
 * Braillix is for Indian schools for the blind. A teacher there is far more likely to be at home in
 * Hindi than in English, and an interface that only speaks English quietly narrows who is allowed
 * to run the lesson. So the whole interface switches, in one control, and the choice is remembered.
 *
 * Two rules keep this honest:
 *
 *  1. **The braille never changes.** Nemeth is Nemeth in every language; the words around it are
 *     what move. A language switch that silently changed the braille code would be the most
 *     dangerous feature in the product.
 *  2. **No half-translated screen.** `i18n.test.ts` fails the build if any key is missing a
 *     language, or if a key is defined and never used. A screen that falls back to English mid
 *     sentence looks broken, and it is.
 *
 * This module deliberately holds its own tiny store rather than living in `src/store.ts`: the store
 * needs to *read* the language to build announcements, so the dependency has to point this way.
 */

import { useCallback, useSyncExternalStore } from 'react';

export type Lang = 'en' | 'hi';

export const LANGS: readonly { id: Lang; label: string; english: string }[] = [
  { id: 'en', label: 'English', english: 'English' },
  { id: 'hi', label: 'हिन्दी', english: 'Hindi' },
];

const STORAGE_KEY = 'braillix.lang';

/* ------------------------------------------------------------------ the strings */

/**
 * Every word the interface says, in both languages.
 *
 * Kept as one flat map on purpose: a nested tree hides gaps, and a gap here is a half-English
 * screen in front of a teacher who does not read English.
 */
const STRINGS: Readonly<Record<string, readonly [en: string, hi: string]>> = {
  /* ---- shell ---- */
  'update.ready': [
    'A newer Braillix is ready on this machine.',
    'इस मशीन पर ब्रेलिक्स का नया संस्करण तैयार है।',
  ],
  'update.reload': ['Use it now', 'अभी इस्तेमाल करें'],
  'app.skip': ['Skip to the display', 'सीधे डिस्प्ले पर जाएँ'],
  'app.sections': ['Sections', 'भाग'],
  'app.language': ['Language', 'भाषा'],

  'nav.device': ['Device', 'डिवाइस'],

  /* ---- board ---- */
  'board.field': ['The expression', 'गणितीय व्यंजक'],
  'board.help': [
    'Write it as you would say it: 1/2, sqrt(9), x^2, 2 <= x, 45 degrees. LaTeX works too.',
    'जैसे बोलते हैं वैसे लिखिए: 1/2, sqrt(9), x^2, 2 <= x, 45 degrees. LaTeX भी चलता है।',
  ],
  /* ---- the blackboard (the lesson rail) ---- */
  'rail.title': ['Today’s lesson, line by line', 'आज का पाठ, पंक्ति दर पंक्ति'],
  'rail.empty': ['The board is empty.', 'बोर्ड अभी खाली है।'],
  'rail.emptyHint': [
    'Write the first line below — the question, then the working, one line at a time. Every line stays on the board so the class can go back to it.',
    'नीचे पहली पंक्ति लिखिए — पहले प्रश्न, फिर हल, एक-एक पंक्ति करके। हर पंक्ति बोर्ड पर बनी रहती है ताकि कक्षा उसे दोबारा पढ़ सके।',
  ],
  'rail.show': ['Put line {n} on the display', 'पंक्ति {n} डिस्प्ले पर दिखाइए'],
  'rail.edit': ['Correct line {n}', 'पंक्ति {n} सुधारिए'],
  'rail.remove': ['Rub out line {n}', 'पंक्ति {n} मिटाइए'],
  'rail.clear': ['Wipe the board', 'पूरा बोर्ड साफ़ कीजिए'],
  'rail.translating': ['working…', 'हो रहा है…'],
  'board.put': ['Put on the board', 'बोर्ड पर लिखिए'],

  'board.h1': ['The blackboard', 'गणित का ब्लैकबोर्ड'],

  /* ---- the senior rail (v5) ---- */
  'keypad.union': ['union', 'सम्मिलन (यूनियन)'],
  'keypad.intersect': ['intersection', 'सर्वनिष्ठ (इंटरसेक्शन)'],
  'keypad.member': ['is a member of', 'का सदस्य है'],
  'keypad.arrow': ['maps to', 'की ओर (→)'],
  'keypad.prime': ['prime — the first derivative', 'प्राइम — पहला अवकलज'],
  'keypad.inverseSine': ['inverse sine', 'व्युत्क्रम ज्या'],
  'keypad.ncr': ['combinations — nCr', 'संयोजन'],
  'keypad.ddx': ['the derivative operator', 'अवकलज संकारक (d/dx)'],
  'keypad.vector': ['a vector', 'सदिश'],
  'keypad.determinant': ['a determinant', 'सारणिक'],
  'keypad.transpose': ['transpose', 'परिवर्त (ट्रांसपोज़)'],
  'keypad.matrix': ['a 2×2 matrix, row by row', '2×2 आव्यूह, पंक्ति दर पंक्ति'],

  /* ---- the chalk tray (v4) ---- */
  'tray.placeholder': ['Write the next line here', 'अगली पंक्ति यहाँ लिखिए'],
  'tray.scan': ['Photograph a page', 'पन्ने की फ़ोटो लीजिए'],
  'tray.save': ['Save', 'सहेजें'],
  'drawer.back': ['Back to the board', 'बोर्ड पर वापस'],

  'tray.write': ['Write by hand', 'हाथ से लिखिए'],

  /* ---- the ink strip (v4) ---- */
  'ink.maths': ['Maths', 'गणित'],
  'ink.words': ['Words', 'शब्द'],
  'ink.modeLabel': ['What are you writing?', 'आप क्या लिख रही हैं?'],
  'ink.undo': ['Undo', 'पीछे जाइए'],
  'ink.clear': ['Wipe', 'मिटाइए'],
  'ink.working': ['Reading your writing…', 'आपकी लिखाई पढ़ी जा रही है…'],
  'ink.landed': ['It is in the box below — check it, then put it on the board.', 'नीचे बॉक्स में आ गया — जाँचिए, फिर बोर्ड पर भेजिए।'],
  'ink.check': ['Not sure about this one — please check the box below.', 'इसमें पक्का नहीं — नीचे बॉक्स में ज़रूर जाँचिए।'],
  'ink.nothing': ['Nothing could be read. Write larger, and one line at a time.', 'कुछ पढ़ा नहीं जा सका। बड़ा लिखिए, और एक बार में एक ही पंक्ति।'],
  'ink.hint': [
    'Write one step, large and clear, the way you would on the board. It lands in the box below the moment you pause.',
    'एक चरण लिखिए — बड़ा और साफ़, जैसे बोर्ड पर लिखतीं। रुकते ही वह नीचे बॉक्स में आ जाएगा।',
  ],
  'ink.canvasLabel': ['The writing surface', 'लिखने की जगह'],
  'ink.unavailable': [
    'Handwriting reading is not installed on this machine. Typing works as always.',
    'इस मशीन पर लिखाई पढ़ने वाला मॉडल नहीं है। टाइपिंग हमेशा की तरह चलती है।',
  ],

  /* ---- the cells strip (v4) ---- */
  'strip.speak': ['Speak', 'बोलें'],
  'strip.structure': ['Explore', 'ढाँचा देखें'],
  'strip.why': ['Why these dots?', 'ये डॉट्स क्यों?'],

  /* ---- the verdict, in one line (v4) ---- */
  'verdict.agrees': ['The dots read back as what you wrote.', 'डॉट्स वही पढ़ते हैं जो आपने लिखा।'],
  'verdict.differs': ['Warning: the dots read back differently. Check before teaching.', 'चेतावनी: डॉट्स कुछ और पढ़ते हैं। पढ़ाने से पहले जाँचें।'],
  'verdict.unchecked': ['Part of this line could not be double-checked.', 'इस पंक्ति का एक हिस्सा दोबारा जाँचा नहीं जा सका।'],
  'board.saveLine': ['Save line {n}', 'पंक्ति {n} सहेजिए'],
  'board.cancelEdit': ['Stop correcting', 'सुधारना छोड़िए'],

  'board.print.empty': ['Type something and it appears here', 'कुछ लिखिए, वह यहाँ दिखेगा'],
  'board.parseFailed': ['That expression could not be read.', 'यह व्यंजक पढ़ा नहीं जा सका।'],


  /* ---- examples ---- */

  /* ---- questions: words and maths on one line ---- */
  'mixed.flip': ['Click to switch between words and maths', 'शब्द और गणित के बीच बदलने के लिए दबाइए'],
  'mixed.switchNote': [
    'This line changes braille code half way through, so the maths opens with ⠸⠩ and closes with ⠸⠱ — that is how the reader knows the rules just changed.',
    'इस पंक्ति में बीच में ब्रेल लिपि बदलती है, इसलिए गणित ⠸⠩ से खुलता है और ⠸⠱ पर बंद होता है — पढ़ने वाले को इसी से पता चलता है कि नियम बदल गए।',
  ],
  'code.nemeth': ['Nemeth · maths', 'नेमेथ · गणित'],
  'code.bharati': ['Bharati · Hindi', 'भारती · हिन्दी'],
  'code.literary': ['Grade 1 · words', 'ग्रेड 1 · शब्द'],

  /* ---- keypad ---- */
  'keypad.symbols': ['Symbols', 'चिह्न'],
  'keypad.plus': ['plus', 'जोड़'],
  'keypad.minus': ['minus', 'घटा'],
  'keypad.times': ['times', 'गुणा'],
  'keypad.dividedBy': ['divided by', 'भाग'],
  'keypad.equals': ['equals', 'बराबर'],
  'keypad.fraction': ['fraction, a over b', 'भिन्न, a बटा b'],
  'keypad.squared': ['squared', 'वर्ग'],
  'keypad.power': ['to the power of', 'की घात'],
  'keypad.index': ['subscript', 'अधोलिखित अंक'],
  'keypad.root': ['square root', 'वर्गमूल'],
  'keypad.cubeRoot': ['cube root', 'घनमूल'],
  'keypad.brackets': ['brackets', 'कोष्ठक'],
  'keypad.lessThan': ['less than', 'से छोटा'],
  'keypad.greaterThan': ['greater than', 'से बड़ा'],
  'keypad.atMost': ['less than or equal to', 'से छोटा या बराबर'],
  'keypad.atLeast': ['greater than or equal to', 'से बड़ा या बराबर'],
  'keypad.notEqual': ['not equal to', 'बराबर नहीं'],
  'keypad.about': ['approximately equal to', 'लगभग बराबर'],
  'keypad.pi': ['pi', 'पाई'],
  'keypad.theta': ['theta', 'थीटा'],
  'keypad.degrees': ['degrees', 'डिग्री'],
  'keypad.percent': ['per cent', 'प्रतिशत'],
  'keypad.rupees': ['rupees', 'रुपये'],
  'keypad.infinity': ['infinity', 'अनंत'],
  'keypad.absolute': ['absolute value', 'निरपेक्ष मान'],
  'keypad.sum': ['sum', 'योग'],
  'keypad.integral': ['integral', 'समाकल'],
  'keypad.limit': ['limit', 'सीमा'],
  'keypad.set': ['set', 'समुच्चय'],
  'keypad.squareBrackets': ['square brackets', 'वर्ग कोष्ठक'],
  'keypad.angle': ['angle', 'कोण'],

  /* ---- device ---- */
  'device.sections': ['Device sections', 'डिवाइस के भाग'],
  'device.connect': ['Connect and calibrate', 'जोड़ें और कैलिब्रेट करें'],
  'device.atlas': ['Cell atlas', 'सेल एटलस'],

  /* ---- the printed worksheet ---- */

  /* ---- help and the self-check ---- */
  'nav.help': ['Help', 'सहायता'],
  'help.title': ['Help', 'सहायता'],
  'help.lede': [
    'What Braillix does, how to use it in a lesson, and a button that goes and checks whether everything on this laptop is actually working.',
    'ब्रेलिक्स क्या करता है, कक्षा में इसे कैसे चलाएँ, और एक बटन जो जाकर जाँचता है कि इस लैपटॉप पर सब सचमुच काम कर रहा है या नहीं।',
  ],
  'help.check': ['Is everything working?', 'क्या सब काम कर रहा है?'],
  'help.checkLede': [
    'This does the work rather than reading a setting: it translates a known expression and compares the answer, fetches the braille tables from this machine, and writes to storage. It takes about a second.',
    'यह सेटिंग पढ़कर नहीं बताता, बल्कि सचमुच करके देखता है: एक जाना-पहचाना व्यंजक अनूदित करके उत्तर मिलाता है, इसी मशीन से ब्रेल तालिकाएँ लाता है, और सहेजकर देखता है। लगभग एक सेकंड लगता है।',
  ],
  'help.run': ['Run the check', 'जाँच चलाइए'],
  'help.running': ['Checking…', 'जाँच हो रही है…'],
  'help.copy': ['Copy the report', 'रिपोर्ट कॉपी कीजिए'],
  'help.copied': ['Copied', 'कॉपी हो गई'],
  'help.allWell': ['Everything needed for a lesson is working.', 'कक्षा के लिए ज़रूरी सब कुछ चल रहा है।'],
  'help.someWarn': [
    'The lesson will work. Some extras are not installed — each one says what it needs.',
    'कक्षा चल जाएगी। कुछ अतिरिक्त चीज़ें स्थापित नहीं हैं — हर एक बता रही है उसे क्या चाहिए।',
  ],
  'help.someFail': [
    'Something is wrong that would affect what a child reads. Do not use this build in a lesson until it passes.',
    'कुछ ऐसा ग़लत है जो बच्चे के पढ़ने पर असर डालेगा। जब तक यह ठीक न हो, कक्षा में इसका उपयोग न करें।',
  ],
  'check.engine': ['The maths engine', 'गणित इंजन'],
  'check.nemeth': ['Nemeth translation', 'नेमेथ अनुवाद'],
  'check.readback': ['Reading the dots back', 'डॉट्स को वापस पढ़ना'],
  'check.bharati': ['Hindi braille', 'हिन्दी ब्रेल'],
  'check.offline': ['Works without the internet', 'बिना इंटरनेट काम करना'],
  'check.storage': ['Saving your work', 'आपका काम सहेजना'],
  'check.recognition': ['Reading handwriting', 'लिखावट पढ़ना'],
  'check.speech': ['Speech', 'वाणी'],
  'check.usb': ['Connecting by cable', 'तार से जोड़ना'],
  'check.pass': ['working', 'चल रहा है'],

  /* What each check found, and what to do about it. Prose a teacher reads, so it is translated —
     unlike the status strip's one-line diagnostics, which quote commands and API names (D7.8). */
  'check.engineOk': ['One half is {braille}, exactly as the Nemeth table says.', 'आधा {braille} है, ठीक वैसे ही जैसे नेमेथ तालिका कहती है।'],
  'check.engineDead': [
    'The maths engine did not start, so the cells would show ordinary braille, not Nemeth.',
    'गणित इंजन चालू नहीं हुआ, इसलिए सेल में नेमेथ नहीं बल्कि आम ब्रेल दिखेगी।',
  ],
  'check.engineDeadFix': [
    'Reload the page. If it persists, run `npm install` again — public/sre/mathmaps may be missing.',
    'पन्ना दोबारा लोड कीजिए। फिर भी न हो तो `npm install` दोबारा चलाइए — public/sre/mathmaps ग़ायब हो सकता है।',
  ],
  'check.engineWrong': ['One half translated to {got}, and it should be {want}.', 'आधा {got} में बदला, जबकि होना चाहिए {want}।'],
  'check.dontUse': [
    'Do not use this build in a lesson. Reinstall Braillix and run the check again.',
    'इस बिल्ड को कक्षा में मत चलाइए। ब्रेलिक्स दोबारा स्थापित कीजिए और जाँच फिर चलाइए।',
  ],
  'check.nemethOk': ['A quadratic is {count} cells, and every one matches.', 'एक द्विघात {count} सेल का है, और हर सेल मेल खाती है।'],
  'check.nemethWrong': ['A quadratic translated to {got}, and it should be {want}.', 'द्विघात {got} में बदला, जबकि होना चाहिए {want}।'],
  'check.readbackOk': [
    'The dots read back as {reading} — and the checker still catches braille that is wrong.',
    'डॉट्स वापस {reading} पढ़े गए — और जाँचने वाला गलत ब्रेल अब भी पकड़ लेता है।',
  ],
  'check.readbackWrong': [
    'The dots read back as {got}, but should say {want}. Do not use this machine for a lesson.',
    'डॉट्स {got} पढ़े गए, जबकि {want} होना चाहिए। इस मशीन को पाठ के लिए इस्तेमाल न करें।',
  ],
  'check.readbackBlunt': [
    'The checker accepted braille that is deliberately broken, so its verdicts cannot be relied on.',
    'जाँचने वाले ने जानबूझकर बिगाड़ी गई ब्रेल भी स्वीकार कर ली, इसलिए उसके निर्णय पर भरोसा नहीं किया जा सकता।',
  ],
  'check.bharatiOk': ['गणित is {braille}, as the Bharati table says.', 'गणित {braille} है, जैसा भारती तालिका कहती है।'],
  'check.bharatiWrong': [
    'गणित translated to {got}, and it should be {want}. Hindi words would be wrong on the display.',
    'गणित {got} में बदला, जबकि होना चाहिए {want}। डिस्प्ले पर हिन्दी शब्द ग़लत आएँगे।',
  ],
  'check.offlineOk': [
    'The Nemeth tables are on this machine ({size} KB). No network is needed.',
    'नेमेथ तालिकाएँ इसी मशीन पर हैं ({size} KB)। किसी नेटवर्क की ज़रूरत नहीं।',
  ],
  'check.offlineBad': ['The local Nemeth tables could not be read ({reason}).', 'स्थानीय नेमेथ तालिकाएँ पढ़ी नहीं जा सकीं ({reason})।'],
  'check.offlineFix': [
    'Run `npm install` again. Without them Braillix needs the internet, which a classroom may not have.',
    '`npm install` दोबारा चलाइए। इनके बिना ब्रेलिक्स को इंटरनेट चाहिए, जो कक्षा में शायद न हो।',
  ],
  'check.storageOk': [
    'The lesson on the board will still be here when this laptop is opened tomorrow.',
    'बोर्ड पर लिखा पाठ कल लैपटॉप खोलने पर भी यहीं मिलेगा।',
  ],
  'check.storageBad': ['This browser will not let Braillix save anything.', 'यह ब्राउज़र ब्रेलिक्स को कुछ भी सहेजने नहीं देता।'],
  'check.storageFix': [
    'Leave private browsing, or allow site data. Everything else works; nothing will be remembered.',
    'निजी ब्राउज़िंग बंद कीजिए, या साइट डेटा की अनुमति दीजिए। बाक़ी सब चलेगा; बस कुछ याद नहीं रहेगा।',
  ],
  'check.recognitionOk': [
    'Handwriting can be read on this device, with no network.',
    'लिखावट इसी डिवाइस पर पढ़ी जा सकती है, बिना नेटवर्क के।',
  ],
  'check.recognitionMissing': ['The handwriting model is not installed on this machine.', 'लिखावट पढ़ने वाला मॉडल इस मशीन पर स्थापित नहीं है।'],
  'check.recognitionFix': [
    'Run `npm run fetch:model` once (76 MB). Everything else works without it — type the maths instead.',
    'एक बार `npm run fetch:model` चलाइए (76 MB)। इसके बिना भी बाक़ी सब चलता है — गणित टाइप कर लीजिए।',
  ],
  'check.speechOk': ['{language} speech: {voice}.', '{language} वाणी: {voice}।'],
  'check.speechMissing': ['This machine has no {language} voice installed.', 'इस मशीन पर {language} की कोई आवाज़ स्थापित नहीं है।'],
  'check.speechFix': [
    'The braille and the written transcript are unaffected. Install the language pack in Windows settings to hear it.',
    'ब्रेल और लिखा हुआ पाठ इससे अछूते हैं। सुनने के लिए विंडोज़ सेटिंग्स में भाषा पैक स्थापित कीजिए।',
  ],
  'check.usbOk': ['A pod can be connected over USB from this browser.', 'इस ब्राउज़र से USB के ज़रिए पॉड जोड़ा जा सकता है।'],
  'check.usbMissing': ['This browser cannot open a USB port.', 'यह ब्राउज़र USB पोर्ट नहीं खोल सकता।'],
  'check.usbFix': [
    'Use Chrome or Edge on a laptop to connect a pod by cable, or connect over Wi-Fi instead.',
    'तार से पॉड जोड़ने के लिए लैपटॉप पर Chrome या Edge चलाइए, या Wi-Fi से जोड़िए।',
  ],
  'check.systemLanguage': ['English', 'हिन्दी'],
  'check.someVoice': ['a system voice', 'सिस्टम की आवाज़'],
  'check.warn': ['not installed', 'स्थापित नहीं'],
  'check.fail': ['wrong', 'ग़लत'],

  'help.howTo': ['How to use it in a lesson', 'कक्षा में कैसे चलाएँ'],
  'help.step1': ['Write the question on the Board. Two things check it for you: it is shown in print, and “What the dots say” reads the braille back and tells you whether it matches.', 'बोर्ड पर सवाल लिखिए। दो चीज़ें उसे जाँचती हैं: वह छपाई में दिखता है, और “डॉट्स क्या कह रहे हैं” ब्रेल को वापस पढ़कर बताता है कि वह मेल खाती है या नहीं।'],
  'help.step2': ['Press Enter and the line goes on the board. Teach the way you write on a blackboard — the question, then the working, line by line. Every line stays on the board, and one press shows any of them again.', 'Enter दबाइए और पंक्ति बोर्ड पर चली जाती है। जैसे ब्लैकबोर्ड पर लिखकर पढ़ाते हैं वैसे ही पढ़ाइए — पहले सवाल, फिर हल, पंक्ति दर पंक्ति। हर पंक्ति बोर्ड पर बनी रहती है, और एक दबाने से फिर दिख जाती है।'],
  'help.step3': ['The display’s arrows — and the Prev/Next buttons on the pod itself — walk the whole lesson: through a long line first, then on to the next line of the working. PageUp and PageDown do the same from the keyboard.', 'डिस्प्ले के तीर — और पॉड के अपने Prev/Next बटन — पूरा पाठ चलकर पढ़ते हैं: पहले लंबी पंक्ति के भीतर, फिर हल की अगली पंक्ति पर। कीबोर्ड से PageUp और PageDown यही करते हैं।'],
  'help.step4': ['With one cell, use Explore structure — a long expression folds into a few cells you can step into.', 'एक ही सेल हो तो “रचना देखिए” चलाइए — लंबा व्यंजक कुछ सेल में सिमट जाता है, जिनमें अंदर जाया जा सकता है।'],
  'help.step5': ['Write by hand with the pencil, or scan a question straight out of the textbook with the camera. Check the reading it shows you — in print, in braille verdict, read aloud — and only then put it on the board. Nothing reaches the display until you approve it.', 'पेंसिल से हाथ से लिखिए, या कैमरे से सवाल सीधे किताब से स्कैन कीजिए। जो पढ़ाई वह दिखाए उसे जाँचिए — छपाई में, ब्रेल जाँच में, और बोलकर — और तभी बोर्ड पर भेजिए। आपकी मंज़ूरी के बिना कुछ भी डिस्प्ले तक नहीं पहुँचता।'],

  'help.keys': ['Keys worth knowing', 'काम के बटन'],
  'help.keysReader': ['move through the expression', 'व्यंजक में चलिए'],
  'help.keysSay': ['say the part you are on', 'जिस हिस्से पर हैं वह बोलिए'],
  'help.keysTeach': ['walk the lesson, line by line', 'पाठ में चलिए, पंक्ति दर पंक्ति'],

  'help.about': ['About Braillix', 'ब्रेलिक्स के बारे में'],
  'help.aboutText': [
    'Braillix turns mathematics into braille and drives a refreshable display, on however many cells it has — one or forty. It has no account, no server and no API key, and everything it does works with the network unplugged. Nemeth is used for the mathematics; the words around it are written in Bharati Braille, which is the same for all nine Indian scripts — Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada and Malayalam. Both tables are cited in the repository. Nothing is taken on trust: the braille that reaches the display is read back by separate engines that never saw what was typed, and the two readings are compared in front of you.',
    'ब्रेलिक्स गणित को ब्रेल में बदलता है और रिफ्रेशेबल डिस्प्ले चलाता है — चाहे उसमें एक सेल हो या चालीस। इसमें न कोई खाता है, न सर्वर, न कोई API कुंजी, और यह सब कुछ नेटवर्क के बिना करता है। गणित के लिए नेमेथ; आसपास के शब्द भारती ब्रेल में, जो नौ भारतीय लिपियों के लिए एक ही है — देवनागरी, बांग्ला, गुरमुखी, गुजराती, ओड़िया, तमिल, तेलुगु, कन्नड़ और मलयालम। दोनों तालिकाओं के स्रोत रिपॉज़िटरी में दर्ज हैं। यहाँ कुछ भी भरोसे पर नहीं छोड़ा गया: जो ब्रेल डिस्प्ले पर पहुँचती है, उसे अलग इंजन वापस पढ़ते हैं — जिन्होंने आपका लिखा कभी देखा ही नहीं — और दोनों पढ़ाईयाँ आपके सामने मिलाई जाती हैं।',
  ],

  /* ---- marking an answer ---- */

  /* ---- the class ---- */




  /* ---- teaching ---- */

  /* ---- adding from the board ---- */

  /* ---- practice ---- */

  /* ---- the syllabus, proven live ---- */
  'cov.title': ['The syllabus, proven here', 'पाठ्यक्रम, यहीं प्रमाणित'],
  'cov.lede': [
    'One press walks the whole school curriculum — arithmetic to calculus, classes 1 to 12 — through this laptop: every line translated, and read back by engines that never saw it.',
    'एक बार दबाइए और पूरा स्कूली पाठ्यक्रम — अंकगणित से कलन तक, कक्षा 1 से 12 — इसी लैपटॉप से गुज़रता है: हर पंक्ति का अनुवाद, और फिर उन इंजनों से वापस पढ़ाई जो उसे कभी देखे ही नहीं।',
  ],
  'cov.run': ['Prove the syllabus', 'पाठ्यक्रम प्रमाणित कीजिए'],
  'cov.running': ['Proving… {done} of {total} lines', 'प्रमाणित हो रहा है… {total} में से {done} पंक्तियाँ'],
  'cov.summary': [
    '{clean} of {total} curriculum lines translate and read back cleanly, across {topics} topics, in {s} seconds on this machine.',
    '{total} में से {clean} पाठ्यक्रम पंक्तियाँ साफ़ अनुवाद होकर वापस पढ़ी गईं, {topics} विषयों में, इसी मशीन पर {s} सेकंड में।',
  ],
  'cov.classes': ['classes {classes}', 'कक्षा {classes}'],

  /* ---- warming the recognisers ---- */
  'cap.warming': ['getting ready · {pc}%', 'तैयार हो रहा है · {pc}%'],
  'cap.warm': ['ready — reads in under a second', 'तैयार — एक सेकंड से कम में पढ़ता है'],

  /* ---- scanning a full question ---- */
  'rec.fullQuestion': ['A full question', 'पूरा सवाल'],
  'qs.title': ['Scan a question from the book', 'किताब से सवाल स्कैन कीजिए'],
  'qs.lede': [
    'Photograph the question, then drag a box around each part in reading order — the sentence first, then the maths. Each part is read on this laptop and shown to you before anything reaches the display.',
    'सवाल की फ़ोटो लीजिए, फिर पढ़ने के क्रम में हर हिस्से के चारों ओर बॉक्स खींचिए — पहले वाक्य, फिर गणित। हर हिस्सा इसी लैपटॉप पर पढ़ा जाता है और डिस्प्ले तक पहुँचने से पहले आपको दिखाया जाता है।',
  ],
  'qs.startOver': ['Start this photo again', 'यह फ़ोटो फिर से शुरू कीजिए'],
  'qs.dragHint': [
    'Drag a box around one part of the question.',
    'सवाल के एक हिस्से के चारों ओर बॉक्स खींचिए।',
  ],
  'qs.photoAlt': ['The photographed question', 'सवाल की फ़ोटो'],
  'qs.wholeWords': ['Read the whole photo as words', 'पूरी फ़ोटो शब्दों के रूप में पढ़िए'],
  'qs.wholeMaths': ['Read the whole photo as maths', 'पूरी फ़ोटो गणित के रूप में पढ़िए'],
  'qs.whatIsThis': ['What is in this box?', 'इस बॉक्स में क्या है?'],
  'qs.itsWords': ['Words', 'शब्द'],
  'qs.itsMaths': ['Maths', 'गणित'],
  'qs.nothingRead': ['Nothing could be read in that box. Draw it a little larger.', 'इस बॉक्स में कुछ पढ़ा नहीं जा सका। इसे थोड़ा बड़ा खींचिए।'],
  'qs.wordsUnavailable': ['Word reading is not available.', 'शब्द पढ़ना उपलब्ध नहीं है।'],
  'qs.wordsNote': ['read as words · {pc}% sure', 'शब्दों के रूप में पढ़ा · {pc}% विश्वास'],
  'qs.mathsNote': ['read as maths · {ms} ms', 'गणित के रूप में पढ़ा · {ms} ms'],
  'qs.theLine': ['The question, part by part — correct anything that is wrong', 'सवाल, हिस्सा-दर-हिस्सा — जो ग़लत हो उसे सुधारिए'],
  'qs.words': ['Words', 'शब्द'],
  'qs.maths': ['Maths', 'गणित'],
  'qs.checkThis': ['Not sure — check this', 'पक्का नहीं — इसे जाँचिए'],
  'qs.removePart': ['Remove this part', 'यह हिस्सा हटाइए'],
  'qs.doubtWarning': [
    'A part above is marked “not sure”. Check it against the book — or correct it — before you send it. It will not read itself right.',
    'ऊपर एक हिस्सा “पक्का नहीं” चिह्नित है। भेजने से पहले किताब से मिलाइए — या सुधारिए। वह अपने आप सही नहीं होगा।',
  ],

  /* ---- reading handwriting ---- */
  'rec.notInstalled': ['Recognition is not installed.', 'पहचान स्थापित नहीं है।'],
  'rec.notInstalledFix': [
    'Everything else in Braillix works exactly as it does with it — type the expression instead and nothing is lost but the photograph.',
    'ब्रेलिक्स का बाक़ी सब वैसे ही चलता है — व्यंजक टाइप कर दीजिए, सिर्फ़ फ़ोटो का रास्ता बंद है।',
  ],
  'rec.image': ['The image', 'चित्र'],
  'rec.how': ['How to provide the maths', 'गणित कैसे दें'],
  'rec.photoOrFile': ['Photo or file', 'फ़ोटो या फ़ाइल'],
  'rec.writeIt': ['Write it', 'हाथ से लिखिए'],
  'rec.choosePhoto': ['Choose a photo', 'फ़ोटो चुनिए'],
  'rec.chooseLabel': ['Choose a photo of an equation', 'समीकरण की फ़ोटो चुनिए'],
  'rec.cameraNote': [
    'On a phone this opens the camera. On a laptop, pick a picture — there are some ready-made ones below.',
    'फ़ोन पर यह कैमरा खोलता है। लैपटॉप पर कोई चित्र चुनिए — नीचे कुछ तैयार चित्र रखे हैं।',
  ],
  'rec.whatItRead': ['What it read', 'इसने क्या पढ़ा'],
  'rec.chooseSomething': ['Choose or draw something and it will appear here.', 'कुछ चुनिए या बनाइए, वह यहाँ दिखेगा।'],
  'rec.whatItSees': ['What the recogniser sees', 'पहचानकर्ता को क्या दिखता है'],
  'rec.inverted': ['inverted (light writing on a dark background)', 'उलटा किया गया (गहरे पर हल्का लेखन)'],
  'rec.cropped': ['cropped to the writing', 'लेखन तक काटा गया'],
  'rec.reading': ['Reading…', 'पढ़ा जा रहा है…'],
  'rec.readThis': ['Read this image', 'यह चित्र पढ़िए'],
  'rec.typeInstead': [
    'You can always type the expression by hand — the “Type it” tab is right there.',
    'आप व्यंजक हमेशा हाथ से लिख सकते हैं — “लिखिए” वाला हिस्सा सामने ही है।',
  ],
  'rec.good': ['Looks right', 'ठीक लगता है'],
  'rec.uncertain': ['Check this one', 'इसे जाँच लीजिए'],
  'rec.bad': ['Probably misread', 'शायद ग़लत पढ़ा'],
  'rec.onDevice': ['{ms} ms · on this device', '{ms} ms · इसी डिवाइस पर'],
  'rec.correctIt': ['Recognised maths — correct it if it is wrong', 'पहचाना गया गणित — ग़लत हो तो सुधार दीजिए'],
  'rec.checkPrint': ['Check it in print before you send it', 'भेजने से पहले छपाई में जाँच लीजिए'],
  'rec.send': ['Put this on the board', 'इसे बोर्ड पर लगाइए'],
  'rec.lastWord': [
    'Nothing reaches the display until you press that. The model’s answer is a suggestion, not a verdict.',
    'जब तक आप यह नहीं दबाते, डिस्प्ले पर कुछ नहीं जाता। मॉडल का उत्तर एक सुझाव है, फ़ैसला नहीं।',
  ],
  'rec.samples': ['Sample images', 'नमूना चित्र'],
  'rec.secondTry': ['Reading it a second time…', 'दूसरी बार पढ़ा जा रहा है…'],
  'rec.agree': [
    'Read twice, two different ways, and both readings agree.',
    'दो अलग तरीक़ों से दो बार पढ़ा गया, और दोनों बार एक ही निकला।',
  ],
  'rec.disagree': [
    'The second reading came out differently. Pick whichever matches the writing.',
    'दूसरी बार अलग निकला। जो लिखावट से मिलता हो वही चुनिए।',
  ],
  'rec.readingOne': ['First reading', 'पहली बार'],
  'rec.readingTwo': ['With more contrast', 'ज़्यादा कंट्रास्ट के साथ'],
  'rec.draw': ['Draw an equation here', 'यहाँ समीकरण बनाइए'],

  /* ---- device: connection and calibration ---- */
  'hw.title': ['Hardware', 'हार्डवेयर'],
  'hw.lede': [
    'Braillix is complete without any of this. Connect a pod and the same frames go out over the wire instead of onto the screen — nothing else changes.',
    'इसके बिना भी ब्रेलिक्स पूरा है। पॉड जोड़िए और वही फ़्रेम स्क्रीन के बजाय तार पर चले जाते हैं — और कुछ नहीं बदलता।',
  ],
  'hw.connection': ['Connection', 'कनेक्शन'],
  'hw.now': ['Now', 'अभी'],
  'hw.cells': ['Cells', 'सेल'],
  'hw.simulated': ['(simulated)', '(नक़ली)'],
  'hw.reported': ['(reported by the hardware)', '(हार्डवेयर ने बताया)'],
  'hw.firmware': ['Firmware', 'फ़र्मवेयर'],
  'hw.pods': ['Pods', 'पॉड'],
  'hw.useSim': ['Use the simulator', 'सिम्युलेटर चलाइए'],
  'hw.connectUsb': ['Connect over USB', 'USB से जोड़िए'],
  'hw.usbHint': ['Recommended for demos — no network needed', 'प्रदर्शन के लिए सबसे अच्छा — नेटवर्क की ज़रूरत नहीं'],
  'hw.onTheCells': ['On the cells now', 'अभी सेल पर क्या है'],
  'hw.onTheCellsHint': [
    'Whatever is here is exactly what a connected pod is showing. Raise a test dot below and watch it move.',
    'यहाँ जो है, ठीक वही जुड़ा हुआ पॉड दिखा रहा है। नीचे कोई टेस्ट डॉट उठाइए और इसे बदलते देखिए।',
  ],
  'hw.wifiPods': ['Wi-Fi pods (comma separated)', 'Wi-Fi पॉड (अल्पविराम से अलग)'],
  'hw.connect': ['Connect', 'जोड़िए'],
  'hw.podMode': ['Several displays', 'कई डिस्प्ले'],
  'hw.chain': ['Joined into one long line', 'एक लंबी पंक्ति में जुड़े'],
  'hw.chainHint': [
    'Pod 1 shows the first cells, pod 2 the next — one wide display built from several small ones.',
    'पॉड 1 पहली सेल दिखाता है, पॉड 2 अगली — कई छोटे पॉड मिलकर एक चौड़ा डिस्प्ले।',
  ],
  'hw.mirror': ['All showing the same', 'सब एक ही दिखा रहे हैं'],
  'hw.mirrorHint': [
    'Every child gets the same expression under their own fingers. The display is as wide as the smallest pod, so nobody loses the end of the line.',
    'हर बच्चे की उँगलियों के नीचे वही व्यंजक। डिस्प्ले सबसे छोटे पॉड जितना चौड़ा रहता है, ताकि किसी की पंक्ति अधूरी न रहे।',
  ],
  'hw.noPod': [
    'No pod on the bench? Run npm run pod and connect to 127.0.0.1:8080 — it speaks the real protocol.',
    'पॉड मौजूद नहीं? npm run pod चलाइए और 127.0.0.1:8080 से जुड़िए — यह असली प्रोटोकॉल बोलता है।',
  ],
  'hw.simCells': ['Simulated cells', 'नक़ली सेल'],
  'hw.advanced': ['Setting up the hardware', 'हार्डवेयर सेट करना'],
  'hw.advancedHint': [
    'Cam wiring, the test dot, and what travels down the wire. Whoever assembled the display needs this once; a teacher never does.',
    'कैम की वायरिंग, जाँच वाला डॉट, और तार पर क्या जाता है। जिसने डिस्प्ले जोड़ा उसे यह एक बार चाहिए; शिक्षक को कभी नहीं।',
  ],
  'hw.show': ['Show', 'दिखाइए'],
  'hw.hide': ['Hide', 'छिपाइए'],
  'hw.calibration': ['Calibration', 'कैलिब्रेशन'],
  'hw.calLede': [
    'The handoff flags one thing as unconfirmed: whether dot 1 really drives cam track 0. Raise one dot below and look at the cell. If a different dot pops up, correct the mapping here — it is a setting, not a code change.',
    'हैंडऑफ़ में एक बात अपुष्ट है: क्या डॉट 1 सचमुच कैम ट्रैक 0 चलाता है। नीचे कोई एक डॉट उठाइए और सेल देखिए। अगर कोई और डॉट उठे तो यहीं मैपिंग ठीक कर लीजिए — यह सेटिंग है, कोड बदलना नहीं।',
  ],
  'hw.raiseDot': ['Raise a single dot', 'एक डॉट उठाइए'],
  'hw.cam': ['cam {position}', 'कैम {position}'],
  'hw.clear': ['Clear', 'हटाइए'],
  'hw.whichTrack': ['Which cam track each dot drives', 'कौन-सा डॉट कौन-सा कैम ट्रैक चलाता है'],
  'hw.dot': ['Dot', 'डॉट'],
  'hw.camBit': ['Cam track bit', 'कैम ट्रैक बिट'],
  'hw.dotN': ['dot {dot}', 'डॉट {dot}'],
  'hw.bitN': ['bit {bit}', 'बिट {bit}'],
  'hw.reversed': [
    'Cell 1 is on the right (dock assembled the other way round)',
    'सेल 1 दाईं ओर है (डॉक उल्टा जुड़ा है)',
  ],
  'hw.home': ['Home every cell', 'हर सेल को घर भेजिए'],
  'hw.copyConfig': ['Copy config for the hardware team', 'हार्डवेयर टीम के लिए कॉन्फ़िग कॉपी कीजिए'],
  'hw.copied': ['Copied', 'कॉपी हो गया'],
  'hw.sanity': [
    'Sanity check: with this mapping, dots 1-2-5 is cam position {position}. The handoff’s worked example says 19 — if these disagree, the mapping above is not the one the cam was cut for.',
    'जाँच: इस मैपिंग से डॉट 1-2-5 की कैम स्थिति {position} बनती है। हैंडऑफ़ के उदाहरण में 19 है — अगर ये अलग हैं तो ऊपर की मैपिंग वह नहीं है जिसके लिए कैम कटी थी।',
  ],
  'hw.wire': ['What goes over the wire', 'तार पर क्या जाता है'],
  'hw.wireLede': [
    'The pod never sees braille, a language, or a maths code — only cam numbers 0–63. That is what lets the translation change without anyone reflashing a board.',
    'पॉड कभी ब्रेल, भाषा या गणित की लिपि नहीं देखता — सिर्फ़ 0–63 के कैम नंबर। इसीलिए अनुवाद बदलने पर किसी बोर्ड को दोबारा फ़्लैश नहीं करना पड़ता।',
  ],
  'hw.protoNote': [
    'Full specification in docs/PROTOCOL.md. The same verbs work over USB serial as newline-delimited JSON at 115200 baud, so one firmware serves both links.',
    'पूरा विवरण docs/PROTOCOL.md में है। यही आदेश USB सीरियल पर 115200 बॉड पर न्यूलाइन-अलग JSON के रूप में चलते हैं, इसलिए एक ही फ़र्मवेयर दोनों रास्तों के लिए काफ़ी है।',
  ],

  /* ---- device: the cell atlas ---- */
  'atlas.title': ['Cell atlas', 'सेल एटलस'],
  'atlas.lede': [
    'Every pattern a single braille cell can make — sixty-four of them, one per cam position. This is the sheet to hold against the physical cam: if a printed cell shows the wrong dots, the cam number here and the track order on the disc disagree.',
    'एक ब्रेल सेल जितने भी रूप बना सकती है — चौंसठ, हर कैम स्थिति के लिए एक। यही वह पन्ना है जिसे असली कैम के सामने रखकर मिलाना है: अगर छपी सेल में ग़लत डॉट दिखें तो यहाँ का कैम नंबर और डिस्क पर ट्रैक का क्रम मेल नहीं खाते।',
  ],
  'atlas.profile': ['Wiring profile: dot→bit {order} · {order2} order', 'वायरिंग प्रोफ़ाइल: डॉट→बिट {order} · {order2} क्रम'],
  'atlas.reversed': ['reversed', 'उल्टा'],
  'atlas.normal': ['normal', 'सामान्य'],
  'atlas.cam': ['cam {position}', 'कैम {position}'],
  'atlas.blank': ['blank', 'खाली'],

  /* ---- the display ---- */
  'display.title': ['The display', 'डिस्प्ले'],
  'display.cells': ['Cells', 'सेल'],
  'display.oneCell': [
    'One cell — the hardware that exists today. A whole equation still has to fit through it.',
    'एक सेल — आज जो हार्डवेयर मौजूद है। पूरा समीकरण इसी एक सेल से पढ़ना है।',
  ],
  'display.manyCells': [
    '{count} cells — stack more and the same expression simply spreads out.',
    '{count} सेल — जितने बढ़ाएँ, वही व्यंजक उतना ही फैल जाता है।',
  ],
  'display.previous': ['Previous', 'पिछला'],
  'display.next': ['Next', 'अगला'],
  'display.braille': ['The braille', 'ब्रेल'],
  'display.stepIn': ['step in', 'अंदर जाएँ'],

  /* ---- the reading window ---- */
  'window.nothing': ['nothing to read', 'पढ़ने को कुछ नहीं'],
  'window.one': ['one cell', 'एक सेल'],
  'window.all': ['all {total} cells', 'सभी {total} सेल'],
  'window.single': ['cell {index} of {total}', '{total} में से सेल {index}'],
  'window.range': ['cells {from}–{to} of {total}', '{total} में से सेल {from}–{to}'],

  /* ---- status strip ---- */
  'status.title': ['System status', 'सिस्टम की स्थिति'],
  'status.display': ['Display', 'डिस्प्ले'],
  'status.motion': ['Motion', 'गति'],
  'status.idle': ['idle', 'खाली'],
  'status.ready': ['ready', 'तैयार'],
  'status.checking': ['checking', 'जाँच जारी'],
  'status.degraded': ['degraded', 'सीमित'],
  'status.off': ['off', 'बंद'],
  'cap.sre': ['Maths engine', 'गणित इंजन'],
  'cap.speech': ['Speech', 'वाणी'],
  'cap.recognition': ['Recognition', 'पहचान'],
  'cap.usb': ['USB display', 'USB डिस्प्ले'],
  'cap.pod': ['Display', 'डिस्प्ले'],
  'cap.offline': ['Offline copy', 'ऑफ़लाइन प्रति'],

  /* ---- the reader ---- */
  'reader.title': ['How to read it', 'कैसे पढ़ें'],
  'reader.mode': ['Reading mode', 'पढ़ने का तरीका'],
  'reader.whole': ['Whole expression', 'पूरा व्यंजक'],
  'reader.explore': ['Explore structure', 'रचना देखिए'],
  'reader.wholeBlurb': [
    'Every cell of the expression in order — what a conventional braille display does. On one cell that is {count} separate readings, with nothing to tell you where you are. Try Explore structure.',
    'व्यंजक की हर सेल क्रम से — जैसा आम ब्रेल डिस्प्ले करता है। एक ही सेल पर यह {count} अलग-अलग पाठ हैं, और यह बताने वाला कुछ नहीं कि आप कहाँ हैं। “रचना देखिए” आज़माइए।',
  ],
  'reader.youAreOn': ['You are on {label}.', 'आप {label} पर हैं।'],
  'reader.nothing': ['nothing', 'कुछ नहीं'],
  'reader.showingFull': ['Showing it in full.', 'पूरा दिखाया जा रहा है।'],
  'reader.shownBecause': ['Shown in full — {reason}.', 'पूरा दिखाया गया — {reason}।'],
  'reader.folded': ['Its parts are folded into ⠿ — step into one to read it.', 'इसके हिस्से ⠿ में समेटे गए हैं — किसी एक में जाकर पढ़िए।'],
  'reader.move': ['Move through the expression', 'व्यंजक में घूमिए'],
  'reader.out': ['Out', 'बाहर'],
  'reader.prev': ['Prev', 'पिछला'],
  'reader.say': ['Say', 'बोलिए'],
  'reader.next': ['Next', 'अगला'],
  'reader.in': ['In', 'अंदर'],
  'reader.foldUp': ['Fold the parts back up', 'हिस्सों को फिर समेटिए'],
  'reader.showFull': ['Show this part in full', 'यह हिस्सा पूरा दिखाइए'],
  'reader.keysMove': ['move', 'चलें'],
  'reader.keysExpand': ['expand', 'खोलें'],
  'reader.spoken': ['Spoken', 'बोला गया'],
  'reader.pod': [
    'The same three moves are the pod’s three buttons: Prev, Select (in; hold to go out), Next.',
    'यही तीन गतियाँ पॉड के तीन बटन हैं: Prev, Select (अंदर; दबाए रखें तो बाहर), Next।',
  ],
  'reader.speakAsIRead': ['Speak as I read', 'पढ़ते समय बोलिए'],
  'reader.rate': ['Rate', 'गति'],
  'reader.noStructureQuestion': [
    'This is a question with words in it, so there is no single expression to walk through. Reading the whole line still works, and the maths inside it is still Nemeth.',
    'इस पंक्ति में शब्द भी हैं, इसलिए घूमने के लिए कोई एक व्यंजक नहीं है। पूरी पंक्ति पढ़ना अब भी चलता है, और उसके अंदर का गणित अब भी नेमेथ है।',
  ],
  'reader.noStructure': [
    'Structure analysis isn’t available for this expression, so exploring is switched off. Reading the whole expression still works.',
    'इस व्यंजक की रचना का विश्लेषण उपलब्ध नहीं है, इसलिए “रचना देखिए” बंद है। पूरा व्यंजक पढ़ना अब भी चलता है।',
  ],

  /* ---- the evidence table ---- */
  'evidence.count': ['{count} cells · {codes}', '{count} सेल · {codes}'],
  'evidence.countOne': ['1 cell · {codes}', '1 सेल · {codes}'],
  'strip.nemeth': ['Nemeth', 'नेमेथ'],
  'strip.bharati': ['Bharati', 'भारती'],
  'strip.literary': ['Grade 1', 'ग्रेड 1'],
  'evidence.empty': [
    'Nothing translated yet. Write an expression — or pick an example — and every cell, dot and cam number will be listed here.',
    'अभी कुछ अनूदित नहीं हुआ। कोई व्यंजक लिखिए — या उदाहरण चुनिए — और हर सेल, डॉट और कैम नंबर यहाँ दिखेगा।',
  ],
  'evidence.caption': [
    'Every braille cell in this expression, with its raised dots, what it means in Nemeth, and the cam position sent to the hardware.',
    'इस व्यंजक की हर ब्रेल सेल — उसके उठे हुए डॉट, नेमेथ में उसका अर्थ, और हार्डवेयर को भेजी गई कैम स्थिति।',
  ],
  'evidence.col.index': ['#', '#'],
  'evidence.col.cell': ['Cell', 'सेल'],
  'evidence.col.dots': ['Dots', 'डॉट'],
  'evidence.col.meaning': ['What it means', 'इसका अर्थ'],
  'evidence.col.cam': ['Cam', 'कैम'],
  'evidence.jump': ['Scroll the display to cell {index}', 'डिस्प्ले को सेल {index} पर ले जाएँ'],
  'evidence.foot': [
    'Cam positions follow the current wiring profile. If the physical cam is wired differently, change it once on the Device screen — the braille above never changes.',
    'कैम स्थितियाँ मौजूदा वायरिंग प्रोफ़ाइल के अनुसार हैं। अगर असली कैम अलग तरह से जुड़ी है तो डिवाइस स्क्रीन पर एक बार बदल दीजिए — ऊपर की ब्रेल कभी नहीं बदलती।',
  ],

  /* ---- spoken announcements (ARIA live regions) ---- */
  'say.display': ['Display: {count} cells, {label}.', 'डिस्प्ले: {count} सेल, {label}।'],
  'say.displayOne': ['Display: one cell, {label}.', 'डिस्प्ले: एक सेल, {label}।'],
  'say.cellsNow': ['Display is now {count} cells.', 'अब डिस्प्ले में {count} सेल हैं।'],
  'say.cellsNowOne': ['Display is now one cell.', 'अब डिस्प्ले में एक सेल है।'],
  'say.homed': ['Every cell homed to blank.', 'हर सेल खाली स्थिति पर लौट आई।'],
  'say.testDot': ['Raising dot {dot} on every cell.', 'हर सेल में डॉट {dot} उठाया जा रहा है।'],
  'say.testCleared': ['Test pattern cleared.', 'जाँच पैटर्न हटा दिया गया।'],
  'say.cells': ['{count} braille cells.', '{count} ब्रेल सेल।'],
  'say.whole': ['Reading the whole expression — {count} cells.', 'पूरा व्यंजक पढ़ा जा रहा है — {count} सेल।'],
  'say.node': ['{label}. {count} cells.', '{label}। {count} सेल।'],
};

export type StringKey = keyof typeof STRINGS;

/** Every key, for the completeness test and for tooling. */
export function allKeys(): StringKey[] {
  return Object.keys(STRINGS) as StringKey[];
}

/* ------------------------------------------------------------------ the store */

function initialLang(): Lang {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'hi') return saved;
  }
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('hi')) return 'hi';
  return 'en';
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function lang(): Lang {
  return current;
}

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const listener of listeners) listener();
}

/* ------------------------------------------------------------------ translating */

/**
 * Look a string up. Interpolates `{name}` placeholders.
 *
 * A missing key returns the key itself rather than an empty string — a visible `board.title` on
 * screen is a bug report; an empty heading is a mystery.
 */
export function translate(key: StringKey, vars?: Record<string, string | number>, forLang: Lang = current): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  let text = forLang === 'hi' ? entry[1] : entry[0];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

/**
 * A pair of strings authored together, in both languages.
 *
 * Used for *content* rather than interface chrome — lesson text, worksheet titles a teacher typed,
 * anything where the two languages belong side by side in the file that owns the meaning rather
 * than in the central table.
 */
export type Bilingual = readonly [en: string, hi: string];

function pick(text: Bilingual, forLang: Lang = current): string {
  return forLang === 'hi' ? text[1] : text[0];
}

/** `pick`, but reactive — the component re-renders when the language changes. Memoised, as above. */
export function usePick(): (text: Bilingual) => string {
  const active = useSyncExternalStore(subscribe, lang, () => 'en' as Lang);
  return useCallback((text: Bilingual) => pick(text, active), [active]);
}

/**
 * The hook every component uses. Re-renders when the language changes.
 *
 * The returned function is memoised on the language, which is not a micro-optimisation: an
 * unmemoised translator is a new function on every render, and any effect that lists it as a
 * dependency then re-runs forever. That cost an hour once; it will not cost another.
 */
export function useT(): (key: StringKey, vars?: Record<string, string | number>) => string {
  const active = useSyncExternalStore(subscribe, lang, () => 'en' as Lang);
  return useCallback((key, vars) => translate(key, vars, active), [active]);
}

/** The current language, reactively. For the switch itself and for anything locale-dependent. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, lang, () => 'en' as Lang);
}
