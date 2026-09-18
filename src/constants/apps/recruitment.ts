export const RECRUITMENT_STAGES = [
  "Applied",
  "Screening",
  "Interview Scheduled",
  "Interview Done",
  "HR Round Done",
  "Offer Sent",
  "Offer Accepted",
  "Hired",
  "Rejected",
] as const;

// Values must match the DB check constraint on recruitment_candidates.source
export const RECRUITMENT_SOURCES = [
  "LinkedIn",
  "Job Portal",
  "Referral",
  "Email",
  "Walk-in",
  "Excel Upload",
  "Other",
] as const;

// Values must match the DB check constraint on recruitment_jobs.type
export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
] as const;

// Values must match the DB check constraint on recruitment_interviews.type
export const INTERVIEW_TYPES = ["Phone", "Video", "In-Person", "Technical", "HR"] as const;
// Values must match the DB check constraint on recruitment_interviews.status
export const INTERVIEW_OUTCOMES = ["Scheduled", "Completed", "Cancelled", "Rescheduled"] as const;
export const FEEDBACK_RATINGS = [1, 2, 3, 4, 5] as const;
export const WORK_MODES = ["On-site", "Remote", "Hybrid"] as const;

export const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan",
  "Argentinian", "Armenian", "Australian", "Austrian", "Azerbaijani",
  "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian",
  "Belgian", "Belizean", "Beninese", "Bhutanese", "Bolivian",
  "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian",
  "Burkinabe", "Burmese", "Burundian", "Cambodian", "Cameroonian",
  "Canadian", "Cape Verdean", "Chilean", "Chinese", "Colombian",
  "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot",
  "Czech", "Danish", "Djiboutian", "Dominican", "Dutch",
  "Ecuadorian", "Egyptian", "Emirati", "Eritrean", "Estonian",
  "Ethiopian", "Fijian", "Finnish", "French", "Gabonese",
  "Gambian", "Georgian", "German", "Ghanaian", "Greek",
  "Grenadian", "Guatemalan", "Guinean", "Guyanese", "Haitian",
  "Honduran", "Hungarian", "Icelandic", "Indian", "Indonesian",
  "Iranian", "Iraqi", "Irish", "Israeli", "Italian",
  "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakhstani",
  "Kenyan", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian",
  "Lebanese", "Liberian", "Libyan", "Liechtenstein", "Lithuanian",
  "Luxembourgish", "Macedonian", "Malagasy", "Malawian", "Malaysian",
  "Maldivian", "Malian", "Maltese", "Mauritanian", "Mauritian",
  "Mexican", "Moldovan", "Monacan", "Mongolian", "Montenegrin",
  "Moroccan", "Mozambican", "Namibian", "Nepalese", "New Zealander",
  "Nicaraguan", "Nigerian", "Norwegian", "Omani", "Pakistani",
  "Panamanian", "Paraguayan", "Peruvian", "Filipino", "Polish",
  "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan",
  "Saudi", "Senegalese", "Serbian", "Sierra Leonean", "Singaporean",
  "Slovak", "Slovenian", "Somali", "South African", "South Korean",
  "Spanish", "Sri Lankan", "Sudanese", "Surinamese", "Swazi",
  "Swedish", "Swiss", "Syrian", "Taiwanese", "Tajik",
  "Tanzanian", "Thai", "Togolese", "Trinidadian", "Tunisian",
  "Turkish", "Turkmen", "Ugandan", "Ukrainian", "Uruguayan",
  "Uzbek", "Venezuelan", "Vietnamese", "Yemeni", "Zambian", "Zimbabwean",
] as const;
