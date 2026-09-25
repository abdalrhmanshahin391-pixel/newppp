export type SampleSubSubject = {
  name: string;
};

export type SampleSubject = {
  name: string;
  subs: SampleSubSubject[];
};

/** Built-in sample subject available to all students on RitaJet. */
export const SAMPLE_SUBJECTS: SampleSubject[] = [
  {
    name: "Sample subject — Cardiology",
    subs: [
      { name: "Sample · Myocardial infarction" },
      { name: "Sample · Heart failure" },
    ],
  },
];
