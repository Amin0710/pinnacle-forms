/**
 * Pinnacle Institute of Education — Google Sheet writer for the enrolment and
 * LLN forms.  FIXED-SCHEMA version.
 *
 * ── HOW TO INSTALL (the form HTML does NOT change; the web-app URL stays the same) ──
 *  1. Open the Spreadsheet, then Extensions → Apps Script.
 *  2. Select all existing code, delete it, and paste this whole file. Save (Ctrl/Cmd-S).
 *  3. Delete any OLD dynamic-layout tabs named "Enrolment" / "LLN" first (this
 *     writer creates fresh, fixed-layout tabs with those same names).
 *  4. Deploy → Manage deployments → ✏ (Edit) → Version: "New version" → Deploy.
 *     The web-app URL is unchanged, so SCRIPT_URL in the HTML needs no edit.
 *
 * Each submission is written as ONE row against the fixed column list below
 * (blank for any field a given submission omits). Any submitted field that is
 * not in the schema is collected into the trailing "Other" column as
 * "key: value" pairs joined by "; ".
 */

/* Who receives the notification email. Comma/space separated. SET THIS to your
 * real recipients (kept from your previous script). */
var NOTIFY_EMAILS = "studentsupport@pinnacleinstitute.com.au";

/* Output tab names. Old dynamic-layout tabs must be deleted manually first. */
var TABS = { Enrolment: "Enrolment", LLN: "LLN" };

/* Trailing catch-all column for any submitted key not present in the schema. */
var OTHER_KEY = "__OTHER__";

/* Reserved submission keys handled specially (never dumped into "Other"):
 *   submittedAt → the "Timestamp" column;  formType → selects the tab. */
var RESERVED_KEYS = { submittedAt: true, formType: true };

/* ============================================================================
 * FIXED SCHEMAS  (ordered [{ section, key, label }])
 * Generated from the form HTML in DOM order, grouped by each card's heading.
 * Priority "Student" columns come first; those keys are not repeated later.
 * NOTE: LLN priority order follows the brief's explicit clause
 *       "keep column order given_names, surname, email, phone".
 * ==========================================================================*/

var ENROLMENT_SCHEMA = [
  { section: "Student", key: "first_name", label: "First given name" },
  { section: "Student", key: "family_name", label: "Family name (surname)" },
  { section: "Student", key: "dob", label: "2. Birth date" },
  { section: "Student", key: "usi", label: "20. Enter your USI (required — apply at usi.gov.au if you don't have one yet)" },
  { section: "Student", key: "submittedAt", label: "Timestamp" },
  { section: "Application for Enrolment", key: "course", label: "Which course would you like to enrol into?" },
  { section: "Application for Enrolment", key: "start_pref", label: "Preferred start date" },
  { section: "Application for Enrolment", key: "start_date", label: "Preferred start date" },
  { section: "Application for Enrolment", key: "studied_before", label: "Have you ever studied with Pinnacle Institute of Education before?" },
  { section: "Application for Enrolment", key: "credit", label: "Do you wish to apply for Credit?" },
  { section: "Application for Enrolment", key: "rpl", label: "Do you wish to apply for Recognition of Prior Learning?" },
  { section: "Application for Enrolment", key: "course_transfer", label: "For international students: are you applying for a Course Transfer (from another Australian registered CRICOS provider)?" },
  { section: "Application for Enrolment", key: "docs", label: "Application checklist — documents you will provide" },
  { section: "Personal Details", key: "single_name", label: "1. Enter your full name" },
  { section: "Personal Details", key: "middle_name", label: "Second given name (middle)" },
  { section: "Personal Details", key: "gender", label: "Male" },
  { section: "Personal Details", key: "home_phone", label: "Home phone" },
  { section: "Personal Details", key: "work_phone", label: "Work phone" },
  { section: "Personal Details", key: "mobile", label: "Mobile" },
  { section: "Personal Details", key: "email", label: "Email address" },
  { section: "Personal Details", key: "alt_email", label: "Alternative email (optional)" },
  { section: "Personal Details", key: "res_building", label: "Building / property name" },
  { section: "Personal Details", key: "res_flat", label: "Flat / unit details" },
  { section: "Personal Details", key: "res_streetno", label: "Street or lot number (e.g. 205 or Lot 118)" },
  { section: "Personal Details", key: "res_street", label: "Street name" },
  { section: "Personal Details", key: "res_suburb", label: "Suburb, locality or town" },
  { section: "Personal Details", key: "res_state", label: "State / territory" },
  { section: "Personal Details", key: "res_postcode", label: "Postcode" },
  { section: "Personal Details", key: "postal_diff", label: "6. Postal address" },
  { section: "Personal Details", key: "post_building", label: "Building / property name" },
  { section: "Personal Details", key: "post_flat", label: "Flat / unit details" },
  { section: "Personal Details", key: "post_streetno", label: "Street or lot number" },
  { section: "Personal Details", key: "post_street", label: "Street name" },
  { section: "Personal Details", key: "post_suburb", label: "Suburb, locality or town" },
  { section: "Personal Details", key: "post_state", label: "State / territory" },
  { section: "Personal Details", key: "post_postcode", label: "Postcode" },
  { section: "Language and Cultural Diversity", key: "birth_country", label: "7. In which country were you born?" },
  { section: "Language and Cultural Diversity", key: "birth_country_other", label: "Please specify country" },
  { section: "Language and Cultural Diversity", key: "other_language", label: "8. Do you speak a language other than English at home?" },
  { section: "Language and Cultural Diversity", key: "other_language_specify", label: "Please specify language" },
  { section: "Language and Cultural Diversity", key: "atsi", label: "9. Are you of Aboriginal or Torres Strait Islander origin?" },
  { section: "Disability", key: "disability", label: "10. Do you consider yourself to have a disability, impairment or long-term condition?" },
  { section: "Disability", key: "disability_areas", label: "10. Do you consider yourself to have a disability, impairment or long-term condition? — 11. Please select the area(s): (you may indicate more than one — see the Disability Supplement below for explanations)" },
  { section: "Schooling", key: "school_level", label: "12. What is your highest COMPLETED school level?" },
  { section: "Schooling", key: "still_school", label: "13. Are you still enrolled in secondary or senior secondary education?" },
  { section: "Previous Qualifications Achieved", key: "prev_quals", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Previous Qualifications Achieved", key: "qual_bachelor", label: "Bachelor degree or higher degree" },
  { section: "Previous Qualifications Achieved", key: "qual_bachelor_id", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Previous Qualifications Achieved", key: "qual_advdip", label: "Advanced diploma or associate degree" },
  { section: "Previous Qualifications Achieved", key: "qual_advdip_id", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Previous Qualifications Achieved", key: "qual_dip", label: "Diploma (or associate diploma)" },
  { section: "Previous Qualifications Achieved", key: "qual_dip_id", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Previous Qualifications Achieved", key: "qual_cert4", label: "Certificate IV (or advanced certificate / technician)" },
  { section: "Previous Qualifications Achieved", key: "qual_cert4_id", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Previous Qualifications Achieved", key: "qual_cert3", label: "Certificate III (or trade certificate)" },
  { section: "Previous Qualifications Achieved", key: "qual_cert3_id", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Previous Qualifications Achieved", key: "qual_cert2", label: "Certificate II" },
  { section: "Previous Qualifications Achieved", key: "qual_cert2_id", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Previous Qualifications Achieved", key: "qual_cert1", label: "Certificate I" },
  { section: "Previous Qualifications Achieved", key: "qual_cert1_id", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Previous Qualifications Achieved", key: "qual_other", label: "Other education (incl. certificates or overseas qualifications not listed)" },
  { section: "Previous Qualifications Achieved", key: "qual_other_id", label: "14. Have you SUCCESSFULLY completed any of the qualifications listed below?" },
  { section: "Employment & Study Reason", key: "employment_status", label: "16. Which BEST describes your current employment status? (tick one)" },
  { section: "Employment & Study Reason", key: "study_reason", label: "17. Which BEST describes your main reason for undertaking this course? (tick one)" },
  { section: "Next of Kin / Emergency Contact", key: "kin_name", label: "Name" },
  { section: "Next of Kin / Emergency Contact", key: "kin_rel", label: "Relationship to you" },
  { section: "Next of Kin / Emergency Contact", key: "kin_address", label: "Address" },
  { section: "Next of Kin / Emergency Contact", key: "kin_home", label: "Home phone" },
  { section: "Next of Kin / Emergency Contact", key: "kin_work", label: "Work phone" },
  { section: "Next of Kin / Emergency Contact", key: "kin_mobile", label: "Mobile" },
  { section: "Next of Kin / Emergency Contact", key: "kin_email", label: "Email" },
  { section: "Employment Details", key: "emp_legal", label: "Employer’s legal name" },
  { section: "Employment Details", key: "emp_position", label: "Your position" },
  { section: "Employment Details", key: "emp_address", label: "Business address" },
  { section: "Employment Details", key: "emp_phone", label: "Phone" },
  { section: "Employment Details", key: "emp_email", label: "Email" },
  { section: "Employment Details", key: "emp_supervisor", label: "Supervisor" },
  { section: "Employment Details", key: "emp_sup_position", label: "Supervisor’s position" },
  { section: "Victorian Student Number & USI", key: "vsn", label: "18. Enter your VSN (if applicable)" },
  { section: "Victorian Student Number & USI", key: "vic_history", label: "19. Have you attended any Victorian school since 2009, or done any training with a VET registered training organisation or Adult and Community Education provider in Victoria since 2011?" },
  { section: "Victorian Student Number & USI", key: "vic_school_name", label: "Most recent Victorian school attended" },
  { section: "Victorian Student Number & USI", key: "vic_rto_1", label: "19. Have you attended any Victorian school since 2009, or done any training with a VET registered training organisation or Adult and Community Education provider in Victoria since 2011?" },
  { section: "Victorian Student Number & USI", key: "vic_rto_2", label: "19. Have you attended any Victorian school since 2009, or done any training with a VET registered training organisation or Adult and Community Education provider in Victoria since 2011?" },
  { section: "Victorian Student Number & USI", key: "vic_rto_3", label: "19. Have you attended any Victorian school since 2009, or done any training with a VET registered training organisation or Adult and Community Education provider in Victoria since 2011?" },
  { section: "Privacy Notice & Declaration", key: "decl_privacy", label: "Decl Privacy" },
  { section: "Privacy Notice & Declaration", key: "decl_consent", label: "Decl Consent" },
  { section: "Privacy Notice & Declaration", key: "decl_true", label: "Decl True" },
  { section: "Privacy Notice & Declaration", key: "sig_name", label: "Student full name (acts as your signature)" },
  { section: "Privacy Notice & Declaration", key: "sig_date", label: "Date" },
  { section: "Privacy Notice & Declaration", key: "under18", label: "Parent / guardian approval — required if you are under 18 years of age at time of application" },
  { section: "Privacy Notice & Declaration", key: "guardian_name", label: "Parent / guardian full name (acts as signature)" },
  { section: "Privacy Notice & Declaration", key: "guardian_date", label: "Date" },
];

var LLN_SCHEMA = [
  { section: "Student", key: "given_names", label: "Given names" },
  { section: "Student", key: "surname", label: "Legal surname" },
  { section: "Student", key: "email", label: "Email address" },
  { section: "Student", key: "phone", label: "Contact phone" },
  { section: "Student", key: "submittedAt", label: "Timestamp" },
  { section: "Part 1 — Pre-Training Review", key: "q1_expectations", label: "Question 1 — What are your expectations in completing this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "q2_workexp", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we1_dates", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we1_position", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we1_duties", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we1_hours", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we2_dates", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we2_position", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we2_duties", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we2_hours", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we3_dates", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we3_position", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we3_duties", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "we3_hours", label: "Question 2 — Do you have any work experience relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "q3_opportunities", label: "Question 3 — What are your expected employment opportunities upon completion of this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "q4_prevquals", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq1_year", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq1_qual", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq1_provider", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq2_year", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq2_qual", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq2_provider", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq3_year", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq3_qual", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "pq3_provider", label: "Question 4 — Do you have any previous qualifications in the same or a similar industry, or any training relevant to this qualification?" },
  { section: "Part 1 — Pre-Training Review", key: "q5_learningneeds", label: "Question 5 — Do you consider yourself to have any specific learning needs or difficulties?" },
  { section: "Part 1 — Pre-Training Review", key: "ln1_need", label: "Question 5 — Do you consider yourself to have any specific learning needs or difficulties?" },
  { section: "Part 1 — Pre-Training Review", key: "ln1_assist", label: "Question 5 — Do you consider yourself to have any specific learning needs or difficulties?" },
  { section: "Part 1 — Pre-Training Review", key: "ln2_need", label: "Question 5 — Do you consider yourself to have any specific learning needs or difficulties?" },
  { section: "Part 1 — Pre-Training Review", key: "ln2_assist", label: "Question 5 — Do you consider yourself to have any specific learning needs or difficulties?" },
  { section: "Part 1 — Pre-Training Review", key: "ln3_need", label: "Question 5 — Do you consider yourself to have any specific learning needs or difficulties?" },
  { section: "Part 1 — Pre-Training Review", key: "ln3_assist", label: "Question 5 — Do you consider yourself to have any specific learning needs or difficulties?" },
  { section: "Part 1 — Pre-Training Review", key: "q6_medical", label: "Question 6 — Do you have any medical conditions which may affect your participation in training?" },
  { section: "Part 1 — Pre-Training Review", key: "mc1_cond", label: "Question 6 — Do you have any medical conditions which may affect your participation in training?" },
  { section: "Part 1 — Pre-Training Review", key: "mc1_assist", label: "Question 6 — Do you have any medical conditions which may affect your participation in training?" },
  { section: "Part 1 — Pre-Training Review", key: "mc2_cond", label: "Question 6 — Do you have any medical conditions which may affect your participation in training?" },
  { section: "Part 1 — Pre-Training Review", key: "mc2_assist", label: "Question 6 — Do you have any medical conditions which may affect your participation in training?" },
  { section: "Part 1 — Pre-Training Review", key: "mc3_cond", label: "Question 6 — Do you have any medical conditions which may affect your participation in training?" },
  { section: "Part 1 — Pre-Training Review", key: "mc3_assist", label: "Question 6 — Do you have any medical conditions which may affect your participation in training?" },
  { section: "Section 2 — Self Reflection", key: "ican_signs", label: "understand signs" },
  { section: "Section 2 — Self Reflection", key: "ican_timesheet", label: "fill in a time sheet" },
  { section: "Section 2 — Self Reflection", key: "ican_change", label: "count and check change when shopping" },
  { section: "Section 2 — Self Reflection", key: "ican_text", label: "send a text message" },
  { section: "Section 2 — Self Reflection", key: "ican_internet", label: "use the internet to get information like telephone numbers" },
  { section: "Section 2 — Self Reflection", key: "ican_leaveform", label: "fill in a leave form" },
  { section: "Section 2 — Self Reflection", key: "ican_memo", label: "read a staff memo" },
  { section: "Section 2 — Self Reflection", key: "ican_email", label: "use a computer to email" },
  { section: "Section 2 — Self Reflection", key: "ican_calculator", label: "use a calculator for + − × ÷" },
  { section: "Section 2 — Self Reflection", key: "ican_newspaper", label: "read a newspaper" },
  { section: "Section 2 — Self Reflection", key: "ican_roster", label: "read a work roster" },
  { section: "Section 2 — Self Reflection", key: "ican_instructions", label: "follow instructions for mixing a solution or to follow a recipe" },
  { section: "Section 2 — Self Reflection", key: "ican_map", label: "read a Google map or street directory" },
  { section: "Section 2 — Self Reflection", key: "ican_msds", label: "read and understand an MSDS" },
  { section: "Section 2 — Self Reflection", key: "ican_manual", label: "use an equipment manual" },
  { section: "Section 2 — Self Reflection", key: "ican_logbook", label: "complete a log book" },
  { section: "Section 2 — Self Reflection", key: "ican_incident", label: "write an incident report" },
  { section: "Part 2 — LLN Assessment", key: "rate_communication", label: "Communication" },
  { section: "Part 2 — LLN Assessment", key: "rate_reading", label: "Reading" },
  { section: "Part 2 — LLN Assessment", key: "rate_writing", label: "Writing" },
  { section: "Part 2 — LLN Assessment", key: "rate_numeracy", label: "Numeracy" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang1_answer", label: "1. Language — Is English your first, second or third language?" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang1_attempts", label: "1. Language — Is English your first, second or third language? — Assessor — number of attempts" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang1_sufficient", label: "1. Language — Is English your first, second or third language? — Assessor — showed sufficient language skills" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang1_comments", label: "Comments (optional)" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang2_answer", label: "2. Education — Highest level of schooling completed?" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang2_attempts", label: "2. Education — Highest level of schooling completed? — Assessor — number of attempts" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang2_sufficient", label: "2. Education — Highest level of schooling completed? — Assessor — showed sufficient language skills" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang2_comments", label: "Comments (optional)" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang3_answer", label: "Year completed" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang3_attempts", label: "3. Schooling — What year did you complete schooling? — Assessor — number of attempts" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang3_sufficient", label: "3. Schooling — What year did you complete schooling? — Assessor — showed sufficient language skills" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang3_comments", label: "Comments (optional)" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang4_answer", label: "4. Certification — Why do you want to complete this qualification?" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang4_attempts", label: "4. Certification — Why do you want to complete this qualification? — Assessor — number of attempts" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang4_sufficient", label: "4. Certification — Why do you want to complete this qualification? — Assessor — showed sufficient language skills" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang4_comments", label: "Comments (optional)" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang5_answer", label: "How you travelled" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang5_attempts", label: "5. Travel — How did you travel here today? — Assessor — number of attempts" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang5_sufficient", label: "5. Travel — How did you travel here today? — Assessor — showed sufficient language skills" },
  { section: "Section 1 — Language (Assessor to complete)", key: "lang5_comments", label: "Comments (optional)" },
  { section: "Section 2 — Literacy", key: "lit1", label: "1. What does the word “Positive” mean?" },
  { section: "Section 2 — Literacy", key: "lit2", label: "2. What does “highly flammable” mean?" },
  { section: "Section 2 — Literacy", key: "lit3", label: "3. Do you think that education is important?" },
  { section: "Section 2 — Literacy", key: "lit4", label: "4. In a minimum of 30 words, explain your answer from Question 3" },
  { section: "Section 2 — Literacy", key: "lit5", label: "5. Which sign represents “No Smoking”?" },
  { section: "Section 2 — Literacy", key: "lit6", label: "6. Which sign represents “No Parking”?" },
  { section: "Section 2 — Literacy", key: "lit7", label: "7. Which sign represents “Men and Women”?" },
  { section: "Section 2 — Literacy", key: "lit8", label: "8. Where is the meeting to be held?" },
  { section: "Section 2 — Literacy", key: "lit9", label: "9. What is the meeting about?" },
  { section: "Section 2 — Literacy", key: "lit10", label: "10. When is the date of the meeting?" },
  { section: "Section 2 — Literacy", key: "lit11", label: "11. Who is running the meeting?" },
  { section: "Section 2 — Literacy", key: "lit12", label: "12. How did the author decide that the meeting was a business meeting?" },
  { section: "Section 2 — Literacy", key: "lit13", label: "13. How did the author feel about the meeting being conducted on the street?" },
  { section: "Section 2 — Literacy", key: "lit14", label: "14. Which item has been bought the most?" },
  { section: "Section 2 — Literacy", key: "lit15", label: "15. Which item has been least bought?" },
  { section: "Section 2 — Literacy", key: "lit16", label: "16. Which item is in the middle?" },
  { section: "Section 3 — Numeracy", key: "num1", label: "1. With the bottle standing up, which picture shows the bottle ½ (half) filled?" },
  { section: "Section 3 — Numeracy", key: "num2", label: "2. What weight is greater?" },
  { section: "Section 3 — Numeracy", key: "num3", label: "3. If Sarah is working on Saturday night (with no breaks) from 5pm – 10pm and then on Sunday day from 10am – 3pm, how many hours would she have worked over the weekend?" },
  { section: "Section 3 — Numeracy", key: "num4", label: "4. If a customer’s bill comes to $42.50 and they give you $50.00, how much change would you give back?" },
  { section: "Section 3 — Numeracy", key: "num5", label: "5. Which price would give you the most value for money?" },
  { section: "Section 3 — Numeracy", key: "num6", label: "6. Why does it offer the best value for money?" },
  { section: "Section 4 — Capability in Digital Learning", key: "dig1", label: "1. Which button turns on a computer?" },
  { section: "Section 4 — Capability in Digital Learning", key: "dig2", label: "2. What is not a tool used with a computer?" },
  { section: "Section 4 — Capability in Digital Learning", key: "dig3", label: "3. Name one (1) common internet search engine" },
  { section: "Section 4 — Capability in Digital Learning", key: "dig4", label: "4. Where would deleted documents be found?" },
  { section: "Section 4 — Capability in Digital Learning", key: "prog1_name", label: "5. Name three (3) computer programs and their function" },
  { section: "Section 4 — Capability in Digital Learning", key: "prog1_func", label: "5. Name three (3) computer programs and their function" },
  { section: "Section 4 — Capability in Digital Learning", key: "prog2_name", label: "5. Name three (3) computer programs and their function" },
  { section: "Section 4 — Capability in Digital Learning", key: "prog2_func", label: "5. Name three (3) computer programs and their function" },
  { section: "Section 4 — Capability in Digital Learning", key: "prog3_name", label: "5. Name three (3) computer programs and their function" },
  { section: "Section 4 — Capability in Digital Learning", key: "prog3_func", label: "5. Name three (3) computer programs and their function" },
  { section: "Section 4 — Capability in Digital Learning", key: "word_open", label: "6. These functions are in Microsoft Word. Match each icon to its correct meaning." },
  { section: "Section 4 — Capability in Digital Learning", key: "word_bold", label: "6. These functions are in Microsoft Word. Match each icon to its correct meaning." },
  { section: "Section 4 — Capability in Digital Learning", key: "word_save", label: "6. These functions are in Microsoft Word. Match each icon to its correct meaning." },
  { section: "Student Declaration & Feedback", key: "declaration", label: "Declaration" },
  { section: "Student Declaration & Feedback", key: "decl_name", label: "Student full name (acts as your signature)" },
  { section: "Student Declaration & Feedback", key: "decl_date", label: "Date" },
  { section: "Student Declaration & Feedback", key: "fb_explained", label: "The assessor explained the assessment process well" },
  { section: "Student Declaration & Feedback", key: "fb_environment", label: "The environment for assessment was acceptable" },
  { section: "Student Declaration & Feedback", key: "fb_difficult", label: "The assessment was difficult" },
  { section: "Student Declaration & Feedback", key: "fb_informative", label: "The interview with the assessor was informative" },
  { section: "Student Declaration & Feedback", key: "fb_helpful", label: "The feedback from the assessor was helpful" },
  { section: "Student Declaration & Feedback", key: "fb_necessary", label: "I feel an assessment like this is necessary to enter the security industry" },
  { section: "Student Declaration & Feedback", key: "fb_comment", label: "Please provide comment on the assessment" },
];

/* ========================================================================== */

function schemaFor(formType) {
  if (formType === "Enrolment") return { tab: TABS.Enrolment, schema: ENROLMENT_SCHEMA };
  if (formType === "LLN") return { tab: TABS.LLN, schema: LLN_SCHEMA };
  return null;
}

/* schema + the single trailing "Other" column */
function fullSchema(schema) {
  return schema.concat([{ section: "Other", key: OTHER_KEY, label: "Other" }]);
}

function doPost(e) {
  try {
    var params = (e && e.parameter) || {};
    var cfg = schemaFor(params.formType || "");
    if (!cfg) return ContentService.createTextOutput("Ignored: unknown formType");

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sheet = ensureSheet(cfg.tab, cfg.schema);
      sheet.appendRow(buildRow(cfg.schema, params));
    } finally {
      lock.releaseLock();
    }

    sendNotification(params.formType, cfg.schema, params);
    return ContentService.createTextOutput("OK");
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err);
  }
}

/* collect submitted keys that are not in the schema (and not reserved) */
function extraPairs(schema, params) {
  var known = {};
  fullSchema(schema).forEach(function (c) { known[c.key] = true; });
  var extras = [];
  Object.keys(params).forEach(function (k) {
    if (RESERVED_KEYS[k]) return;
    if (!known[k]) extras.push(k + ": " + params[k]);
  });
  return extras;
}

function buildRow(schema, params) {
  var extras = extraPairs(schema, params);
  return fullSchema(schema).map(function (c) {
    if (c.key === OTHER_KEY) return extras.join("; ");
    if (c.key === "submittedAt") return params.submittedAt || new Date();
    return params[c.key] != null ? params[c.key] : "";
  });
}

/* Create the tab with the two-row header the first time; otherwise reuse it. */
function ensureSheet(tabName, schema) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName(tabName);
  if (existing) return existing;

  var sheet = ss.insertSheet(tabName);
  var cols = fullSchema(schema);
  var n = cols.length;
  var sections = cols.map(function (c) { return c.section; });
  var labels = cols.map(function (c) { return c.label; });

  sheet.getRange(1, 1, 1, n).setValues([sections]);
  sheet.getRange(2, 1, 1, n).setValues([labels]);

  /* row 1: merge each contiguous run of the same section name */
  var start = 0;
  for (var i = 1; i <= n; i++) {
    if (i === n || sections[i] !== sections[start]) {
      if (i - start > 1) sheet.getRange(1, start + 1, 1, i - start).merge();
      start = i;
    }
  }

  sheet
    .getRange(1, 1, 1, n)
    .setBackground("#0687B8")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet
    .getRange(2, 1, 1, n)
    .setBackground("#EAF5FA")
    .setFontWeight("bold")
    .setWrap(true);

  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(Math.min(5, n));
  sheet.autoResizeColumns(1, n);

  return sheet;
}

/* Notification email — a table ordered by the same schema (non-empty rows only). */
function sendNotification(formType, schema, params) {
  if (!NOTIFY_EMAILS) return;
  var cols = fullSchema(schema);
  var extras = extraPairs(schema, params);
  var body = "";
  cols.forEach(function (c) {
    var v =
      c.key === OTHER_KEY
        ? extras.join("; ")
        : c.key === "submittedAt"
        ? params.submittedAt || ""
        : params[c.key] != null ? params[c.key] : "";
    if (v === "" || v == null) return;
    body +=
      "<tr>" +
      "<td style='padding:4px 8px;border:1px solid #d6dfe4;color:#4a5a62'>" + esc(c.section) + "</td>" +
      "<td style='padding:4px 8px;border:1px solid #d6dfe4;font-weight:bold'>" + esc(c.label) + "</td>" +
      "<td style='padding:4px 8px;border:1px solid #d6dfe4'>" + esc(String(v)) + "</td>" +
      "</tr>";
  });
  var html =
    "<h2 style='font-family:Arial,sans-serif'>New " + esc(formType) + " form submission</h2>" +
    "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px'>" +
    "<tr>" +
    "<th style='padding:4px 8px;border:1px solid #d6dfe4;background:#0687B8;color:#fff'>Section</th>" +
    "<th style='padding:4px 8px;border:1px solid #d6dfe4;background:#0687B8;color:#fff'>Field</th>" +
    "<th style='padding:4px 8px;border:1px solid #d6dfe4;background:#0687B8;color:#fff'>Value</th>" +
    "</tr>" + body + "</table>";

  MailApp.sendEmail({
    to: NOTIFY_EMAILS,
    subject: "New " + formType + " form submission",
    htmlBody: html,
  });
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
