#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PT corpus analysis pipeline. Transparent keyword/regex classification, AR+EN.
Outputs per-thread table + aggregates. Counts only; every rule is auditable below."""
import csv, json, re, sys, os
from collections import Counter, defaultdict
from datetime import datetime
csv.field_size_limit(10**9)

DATA = "/sessions/sweet-serene-faraday/mnt/ALL RESPOND CONVERSTAIONS FROM JAN 1st to June 15th "
OUT  = "/sessions/sweet-serene-faraday/mnt/outputs"

SEGMENTS = [
    # (filename, brand, country, segment_label, channel_subtag)
    ("KSA WORKSPACE.csv",            "National", "KSA",     "National-KSA"),
    ("QATAR WORKSPACE.csv",          "National", "Qatar",   "National-Qatar"),
    # NOTE: file names are mislabeled in the source. Verified by 5 signals (Tahsili/Qudrat exams,
    # +974 vs +966 phone codes, Doha mentions, QAR vs SAR currency): INTERNATIONAL.csv is QATAR, INTERNATIONL.csv is KSA.
    ("KSA APEX INTERNATIONAL.csv",   "Apex",     "Qatar",   "Apex-Qatar"),
    ("KSA APEX INTERNATIONL.csv",    "Apex",     "KSA",     "Apex-KSA"),
    ("UAE APEX INTERNATIONAL.csv",   "Apex",     "UAE",     "Apex-UAE"),
    ("Bahran APEX INTERNATIONL.csv", "Apex",     "Bahrain", "Apex-Bahrain"),
    ("JORDAN APEX INTERNTAION PT.csv","Apex",    "Jordan",  "Apex-Jordan"),
]

# ---------- Arabic normalization ----------
AR_DIAC = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭ]')
def norm(s):
    if not s: return ""
    s = s.lower()
    s = AR_DIAC.sub('', s)
    s = s.replace('ـ','')                      # tatweel
    s = re.sub(r'[آأإٱ]','ا', s)  # alef variants -> ا
    s = s.replace('ى','ي')                # ى -> ي
    s = s.replace('ة','ه')                # ة -> ه
    return s

def txt(content):
    try:
        o=json.loads(content)
        if isinstance(o,dict):
            return o.get('text') or o.get('caption') or o.get('body') or ""
    except Exception:
        pass
    return content or ""

def pdate(s):
    try: return datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")
    except Exception: return None

# ---------- detection lexicons (matched on normalized text) ----------
def R(*alts): return re.compile('|'.join(alts))

PAY_LINK = R(r'hyperpay', r'hyperbill', r'pay\.abwaab', r'abwaab\.com/pay', r'paymob',
             r'paytabs', r'myfatoorah', r'sadad', r'tlync', r'tap\.company', r'checkout\.',
             r'رابط الدفع', r'لينك الدفع',
             r'رابط دفع', r'لينك دفع', r'payment link', r'invoice')
PAY_INSTR = R(r'ايبان', r'iban', r'تحويل بنكي',
              r'رقم الحساب', r'الحساب البنكي')
CURRENCY = R(r'ريال', r'ر\.?س', r'درهم', r'دينار',
             r'دولار', r'\bsar\b', r'\bqar\b', r'\baed\b', r'\bjod\b', r'\busd\b', r'\briyal\b')
PRICE_WORD = R(r'سعر', r'اسعار', r'تكلف', r'رسوم',
               r'باقه', r'اشتراك', r'\bprice\b', r'\bcost\b', r'\bfee\b', r'\bpackage\b')
PRICE_ASK = R(r'بكم', r'كم سعر', r'كم السعر', r'كم تكل',
              r'كم الحص', r'كم الباق', r'كم سعر الحص',
              r'السعر', r'الاسعار', r'التكلفه', r'الرسوم',
              r'how much', r'the price', r'\bcost\b', r'\bfees?\b')
DIGIT = re.compile(r'\d')

# ask-parent: require a guardian/spouse token AND a consult verb (co-occurrence), or explicit EN phrase
AP_FAMILY = R(r'والدي', r'والدتي', r'اهلي', r'امي\b', r'ابوي', r'بابا', r'ماما', r'زوجي', r'زوجتي', r'اهل البيت', r'مدير المنزل')
AP_CONSULT= R(r'اشاور', r'بشاور', r'اشوف مع', r'اخذ راي', r'اخذ رايه', r'اراجع', r'اتكلم مع', r'احكي مع', r'استشير', r'ارجع لـ?')
AP_EN     = R(r'ask my (husband|wife|mom|mum|dad|parents?|family)', r'check with my (husband|wife|family|parents?)', r'talk to my (husband|wife|parents?)', r'consult my')
# booking: customer realised payment (high precision intent) vs agent confirmed completed booking (past tense only)
CUST_PAID = R(r'تم الدفع', r'تم التحويل', r'دفعت', r'حولت', r'دفعنا', r'حولنا', r'\bpaid\b', r'payment done', r'سددت', r'تم السداد')
AGENT_CONFIRM = R(r'تم تاكيد الحجز', r'تم تأكيد حجز', r'تم الحجز عزيز', r'تم حجز حصص', r'تم تثبيت الحجز', r'تم استلام الدفع', r'تم استلام المبلغ', r'تم تفعيل')
NEG_BOOK = R(r'لم يتم', r'ما تم', r'لن يتم', r'بيتم', r'سيتم', r'رح يتم', r'راح يتم', r'حتى الان', r'بانتظار رد', r'لسا')
SCHED = R(r'موعد', r'مواعيد', r'الجدول', r'جدول',
          r'متى', r'اي يوم', r'الساعه', r'الاسبوع',
          r'\bschedule\b', r'\bwhen\b', r'reschedule', r'تأجيل', r'تاجيل')

# objections (customer side) — split price-too-high from discount-seeking
OBJ_PRICE_HIGH = R(r'غالي', r'غاليه', r'مكلف', r'مرتفع', r'كثير عل', r'كتير عل', r'expensive', r'too much', r'too expensive', r'ما اقدر ادفع', r'فوق الميزاني')
VOCATIVE = R(r'يا\s?غالي', r'يا\s?الغالي', r'غاليتي', r'ياغالي', r'يالغالي')  # endearment, not "expensive"
ASK_DISCOUNT = R(r'خصم', r'تخفيض', r'discount', r'كوبون', r'coupon', r'كود خصم', r'offer\b', r'افضل سعر', r'اخر سعر', r'سعر افضل')
OBJ_THINK = R(r'بفكر', r'راح افكر', r'افكر فيه', r'بشوف وارجع', r'ارد علي?ك بعد', r'بعدين احكي', r'لاحقا', r'think about', r'get back to you', r'بشاور واخبرك')
OBJ_BUSY = R(r'مشغول', r'ما عندي وقت', r'الجدول مليان', r'مرتبط', r'busy', r'no time', r'full schedule', r'ظروف')
# modality/location concern — require contrast or location-seeking, NOT the bare word "online"
OBJ_ONLINE = R(r'حضوري', r'عن بعد', r'in person', r'in-person', r'وين مقر', r'وين موقع', r'مكانكم',
               r'وينكم', r'مقركم', r'عندكم مقر', r'يجي البيت', r'يجي للبيت', r'تيجي البيت',
               r'online or in', r'اونلاين ولا', r'اونلاين او حضوري', r'حضوري ولا', r'هل هي اونلاين',
               r'هل الحصص اونلاين', r'هل الحصه اونلاين', r'الحصص حضوري', r'اونلاين فقط')
# Apex ad-driven canned entry message (a funnel-ENTRY signal, NOT a modality objection)
ENTRY_TPL = R(r'i want to book .*(online )?(private|trial).*lesson', r'i want to book a trial')
# trial/demo request (conversion lever) and narrow tutor-quality concern
TRIAL_REQ = R(r'حصه تجريب', r'حصه تجريبيه', r'تجريبيه', r'تجربه مجاني', r'حصه مجاني', r'تحديد المستوي', r'\btrial\b', r'\bdemo\b', r'free (lesson|session|class)', r'تجريبي')
TUTOR_QUAL= R(r'خبره المعلم', r'كفاءه المعلم', r'المعلم متمكن', r'ضمان ذهبي', r'في ضمان', r'ضمان النتيج', r'هل المعلم متخصص', r'شهاده المعلم', r'مؤهل', r'qualified', r'certified', r'\bnative\b')

# capability requests
CAP_RESCHED = R(r'تغيير الموعد', r'تاجيل الحص', r'اجل الحص', r'نقل الحص', r'reschedule', r'change the time', r'change time', r'postpone', r'تغيير الحص', r'تبديل الموعد', r'نأجل', r'ناجل', r'الغي حصه اليوم', r'اعاده جدول')
CAP_AVAIL = R(r'متاح اي وقت', r'الاوقات المتاح', r'وقت الاستاذ', r'مواعيد المعلم', r'availability', r'available slots', r'متى المعلم متاح', r'اوقات المعلم')
CAP_PROGRESS = R(r'تقرير', r'درجات الطالب', r'نتيجه الطالب', r'progress report', r'\breport\b', r'فيدباك', r'feedback', r'كيف مستوي', r'تقييم الطالب', r'مستوي ابني', r'مستوي بنتي', r'تقدم الطالب')
CAP_CANCEL = R(r'استرجاع', r'استرداد', r'refund', r'الغاء الاشتراك', r'الغاء الباقه', r'استرجع فلوس', r'cancel.*subscription', r'الغاء الحجز')
CAP_RECORDING = R(r'تسجيل الحص', r'recording', r'ريكورد', r'الحصه المسجل', r'تسجيل للحص')

# ---- TOPIC tags (what a conversation is about) ----
TRIAL_OFFER=R(r'حصه تجريبيه', r'حصة تجريبيه', r'تجريبيه', r'تحديد المستوي', r'حصه مجاني', r'\btrial\b', r'\bdemo\b', r'free (lesson|session|class)')
TRIAL_DONE=R(r'حضر.{0,4}التجريب', r'بعد التجريب', r'اخذ.{0,6}تجريب', r'جربنا', r'خلصت التجريب', r'كانت التجريب', r'التجريبيه كانت', r'after the trial', r'دفعنا.{0,10}تجريب')
EXAM_CONTENT=R(r'رياضيات', r'الرياضيا', r'\bmath', r'فيزيا', r'physics', r'كيميا', r'chemistry', r'احياء', r'biology', r'انجليزي', r'english', r'\bعربي', r'\bعلوم', r'قدرات', r'تحصيلي', r'\bsat\b', r'igcse', r'الصف', r'ابتدائي', r'متوسط', r'ثانوي', r'منهج', r'الوحده', r'الفصل', r'مقرر', r'الترم')
TEACHER_CRED=R(r'خبره المعلم', r'كفاءه المعلم', r'المعلم متخصص', r'مؤهل', r'شهاده المعلم', r'تخصص المعلم', r'خبرته', r'دكتور', r'ماجستير', r'qualified', r'certified', r'\bnative\b', r'مين المعلم', r'مين الاستاذ', r'معلم متمكن', r'كفاءه الاستاذ', r'خبره الاستاذ')
COMPETITOR=R(r'نون اكاديمي', r'\bnoon\b', r'منصه ثاني', r'منصه اخر', r'موقع ثاني', r'غيركم', r'باقي المنصات', r'منصات اخر', r'عند غيرك', r'مركز ثاني', r'معهد ثاني', r'قارنت', r'other platform', r'بسعر اقل عند')
LOGISTICS=R(r'الجدول', r'\bجدول', r'موعد', r'المنصه', r'\bزوم', r'\bzoom', r'google meet', r'جوجل ميت', r'الجهاز', r'الايباد', r'\bالنت\b', r'الانترنت', r'التطبيق', r'رابط الحصه', r'\bplatform', r'\bdevice', r'وقت الحصه', r'اي يوم', r'الساعه', r'كيف الحصه', r'لاب توب', r'كمبيوتر')
SOCIAL_PROOF=R(r'نتائج الطلاب', r'درجات الطلاب', r'اراء الطلاب', r'تجارب الطلاب', r'قصص نجاح', r'طلابكم', r'نصحني', r'نصحتني', r'صديقت', r'\bصديقي', r'\bزميل', r'recommend', r'سمعت عنكم', r'قالولي عنكم', r'حصلوا علي', r'شفت نتائج')

# parent vs student signals
PARENT_SIG = R(r'ابني', r'بنتي', r'ولدي', r'ابنتي', r'اولادي', r'ابنه', r'my son', r'my daughter', r'my kid', r'my child', r'ولدنا', r'ابننا')
STUDENT_SIG = R(r'انا طالب', r'انا بصف', r'صفي', r'امتحاني', r'مادتي', r'i am a student', r'my exam', r'my grade', r'درجتي')

def classify_msg(t_raw):
    t = norm(t_raw)
    f = {}
    f['pay_link']   = bool(PAY_LINK.search(t)) or bool(PAY_INSTR.search(t))
    f['price_quote']= bool((CURRENCY.search(t) and DIGIT.search(t)) or (PRICE_WORD.search(t) and DIGIT.search(t)))
    f['price_ask']  = bool(PRICE_ASK.search(t))
    f['ask_parent'] = bool(AP_EN.search(t)) or (bool(AP_FAMILY.search(t)) and bool(AP_CONSULT.search(t)))
    f['cust_paid']  = bool(CUST_PAID.search(t))
    f['agent_confirm']= bool(AGENT_CONFIRM.search(t)) and not bool(NEG_BOOK.search(t))
    f['sched']      = bool(SCHED.search(t))
    f['obj_price']  = bool(OBJ_PRICE_HIGH.search(t)) and not bool(VOCATIVE.search(t))
    f['ask_discount']=bool(ASK_DISCOUNT.search(t))
    f['obj_think']  = bool(OBJ_THINK.search(t))
    f['obj_busy']   = bool(OBJ_BUSY.search(t))
    f['obj_online'] = bool(OBJ_ONLINE.search(t))
    f['entry_tpl']  = bool(ENTRY_TPL.search(t))
    f['trial_req']  = bool(TRIAL_REQ.search(t))
    f['tutor_qual'] = bool(TUTOR_QUAL.search(t))
    f['cap_resched']= bool(CAP_RESCHED.search(t))
    f['cap_avail']  = bool(CAP_AVAIL.search(t))
    f['cap_prog']   = bool(CAP_PROGRESS.search(t))
    f['cap_cancel'] = bool(CAP_CANCEL.search(t))
    f['cap_rec']    = bool(CAP_RECORDING.search(t))
    f['parent_sig'] = bool(PARENT_SIG.search(t))
    f['student_sig']= bool(STUDENT_SIG.search(t))
    # topic keyword hits (side gating applied in process_file)
    f['t_trial_offer']=bool(TRIAL_OFFER.search(t))
    f['t_trial_done'] =bool(TRIAL_DONE.search(t))
    f['t_exam']       =bool(EXAM_CONTENT.search(t))
    f['t_teacher']    =bool(TEACHER_CRED.search(t))
    f['t_competitor'] =bool(COMPETITOR.search(t))
    f['t_logistics']  =bool(LOGISTICS.search(t))
    f['t_social']     =bool(SOCIAL_PROOF.search(t))
    return f

HUMAN_OUT = {'user','echo'}     # human agent outgoing
AUTO_OUT  = {'workflow','broadcast'}  # automated outgoing

def process_file(fn, brand, country, seg):
    threads = defaultdict(list)
    with open(os.path.join(DATA,fn), encoding='utf-8') as f:
        for row in csv.DictReader(f):
            cid = row['Contact ID']
            dt  = pdate(row['Date & Time'])
            threads[cid].append((dt, row['Sender Type'], row['Content Type'], row['Content'], row['Sub Type']))
    recs=[]
    for cid, msgs in threads.items():
        msgs = [m for m in msgs if m[0] is not None]
        if not msgs: continue
        msgs.sort(key=lambda x:x[0])
        rec = dict(seg=seg, brand=brand, country=country, file=fn, contact=cid,
                   n_msg=len(msgs), n_in=0, n_out_human=0, n_out_auto=0,
                   first=msgs[0][0], last=msgs[-1][0])
        # event timestamps
        ev = defaultdict(list)
        first_in=None; last_in=None; last_out_human=None
        roles_seq=[]
        agg=Counter()
        tp=set()   # topic tags present anywhere in the thread
        in_texts=[]
        for dt,st,ct,content,subt in msgs:
            t_raw = txt(content) if ct in ('text','quick_reply','story_reply') else ('['+ct+']')
            if st=='contact':
                rec['n_in']+=1
                if first_in is None: first_in=dt
                last_in=dt
                roles_seq.append(('in',dt))
                if ct in ('text','quick_reply','story_reply'):
                    in_texts.append((dt,t_raw))
                    f=classify_msg(t_raw)
                    for k,v in f.items():
                        if v: agg['in_'+k]+=1
                    if f['price_ask']: ev['price_ask'].append(dt)
                    if f['ask_parent']: ev['ask_parent'].append(dt)
                    if f['cust_paid']: ev['cust_paid'].append(dt)
                    for o in ('obj_price','ask_discount','obj_think','obj_busy','obj_online','trial_req','tutor_qual','entry_tpl'):
                        if f[o]: ev[o].append(dt)
                    for c in ('cap_resched','cap_avail','cap_prog','cap_cancel','cap_rec'):
                        if f[c]: ev[c].append(dt)
                    if f['trial_req']: tp.add('t_trial_req')
                    for tk in ('t_trial_done','t_exam','t_teacher','t_competitor','t_logistics','t_social'):
                        if f[tk]: tp.add(tk)
                    if f['parent_sig']: agg['parent_sig']+=1
                    if f['student_sig']: agg['student_sig']+=1
            elif st in HUMAN_OUT:
                rec['n_out_human']+=1
                last_out_human=dt
                roles_seq.append(('out',dt))
                if ct in ('text',):
                    f=classify_msg(t_raw)
                    if f['pay_link']: ev['pay_link'].append(dt)
                    if f['price_quote']: ev['price_quote'].append(dt)
                    if f['agent_confirm']: ev['agent_confirm'].append(dt)
                    if f['sched']: ev['agent_sched'].append(dt)
                    if f['t_trial_offer']: tp.add('t_trial_offer')
                    for tk in ('t_trial_done','t_exam','t_teacher','t_competitor','t_logistics','t_social'):
                        if f[tk]: tp.add(tk)
            elif st in AUTO_OUT:
                rec['n_out_auto']+=1
                if st=='broadcast': agg['broadcast']+=1
                if st=='workflow': agg['workflow']+=1
            # else echo handled in HUMAN_OUT
        rec['has_inbound'] = rec['n_in']>0
        rec['agent_replied'] = rec['n_out_human']>0
        rec['first_in']=first_in; rec['last_in']=last_in
        # first human response time (from first inbound to first human outbound after it)
        frt=None
        if first_in is not None:
            for dt,st,ct,content,subt in msgs:
                if st in HUMAN_OUT and dt>=first_in:
                    frt=(dt-first_in).total_seconds(); break
        rec['first_resp_sec']=frt
        # last-message side
        last_role = 'out_human' if (msgs[-1][1] in HUMAN_OUT) else ('in' if msgs[-1][1]=='contact' else 'auto')
        rec['last_role']=last_role
        # ---- drop-after-event logic: did customer send ANYTHING after the LAST occurrence of event? ----
        def dark_after(evname):
            if not ev[evname]: return None  # event never happened
            last_ev=max(ev[evname])
            after = any(dt>last_ev for dt,_st,_ct,_c,_s in msgs if _st=='contact')
            return (0 if after else 1)  # 1 = went dark
        rec['paylink_sent']   = 1 if ev['pay_link'] else 0
        rec['paylink_dark']   = dark_after('pay_link')
        rec['pricequote_sent']= 1 if ev['price_quote'] else 0
        rec['pricequote_dark']= dark_after('price_quote')
        rec['priceask']       = 1 if ev['price_ask'] else 0
        rec['askparent']      = 1 if ev['ask_parent'] else 0
        rec['askparent_dark'] = dark_after('ask_parent')
        rec['agentsched_sent']= 1 if ev['agent_sched'] else 0
        rec['agentsched_dark']= dark_after('agent_sched')
        rec['cust_paid']    = 1 if ev['cust_paid'] else 0
        rec['agent_confirm']= 1 if ev['agent_confirm'] else 0
        rec['booked'] = 1 if (ev['cust_paid'] or ev['agent_confirm']) else 0
        # objections/caps presence
        for o in ('obj_price','ask_discount','obj_think','obj_busy','obj_online','trial_req','tutor_qual','entry_tpl',
                  'cap_resched','cap_avail','cap_prog','cap_cancel','cap_rec'):
            rec[o]= 1 if ev[o] else 0
        rec['parent_sig']=agg.get('parent_sig',0)
        rec['student_sig']=agg.get('student_sig',0)
        rec['n_broadcast']=agg.get('broadcast',0)
        rec['n_workflow']=agg.get('workflow',0)
        # topic tags (what the conversation was about) + reached-link convenience flag
        rec['reached_link']  = rec['paylink_sent']
        rec['t_trial_offer'] = 1 if 't_trial_offer' in tp else 0
        rec['t_trial_req']   = 1 if 't_trial_req'   in tp else 0
        rec['t_trial_done']  = 1 if 't_trial_done'  in tp else 0
        rec['t_exam']        = 1 if 't_exam'        in tp else 0
        rec['t_price']       = 1 if ev['price_ask'] else 0
        rec['t_teacher']     = 1 if 't_teacher'     in tp else 0
        rec['t_competitor']  = 1 if 't_competitor'  in tp else 0
        rec['t_logistics']   = 1 if 't_logistics'   in tp else 0
        rec['t_social']      = 1 if 't_social'      in tp else 0
        recs.append(rec)
    return recs

def main():
    allrecs=[]
    for fn,brand,country,seg in SEGMENTS:
        r=process_file(fn,brand,country,seg)
        allrecs+=r
        print(f"{seg:16s} {fn:34s} threads={len(r)}", file=sys.stderr)
    # write per-thread CSV
    keys=list(allrecs[0].keys())
    with open(os.path.join(OUT,'threads.csv'),'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=keys); w.writeheader()
        for r in allrecs:
            rr=dict(r)
            for k in ('first','last','first_in','last_in'):
                rr[k]= rr[k].isoformat() if rr.get(k) else ''
            w.writerow(rr)
    print("WROTE threads.csv rows=",len(allrecs), file=sys.stderr)

if __name__=='__main__':
    main()
