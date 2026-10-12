import { defineArrayMember, defineField, defineType } from "sanity";

export const learningResourceType = defineType({
  name: "learningResource",
  title: "Library Entry",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: "slug",
      title: "URL slug",
      type: "slug",
      description: "Generate this from the title before publishing.",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "resourceType",
      title: "Resource type",
      type: "string",
      options: {
        list: ["Book", "Course", "Certification", "Research Paper", "Video", "Podcast", "Other"],
        layout: "dropdown",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "customResourceType",
      title: "Custom resource type",
      type: "string",
      description: "When type is Other, enter a label such as Essay or Project. It becomes a library filter automatically. Use the same label for matching entries.",
      hidden: ({ document }) => document?.resourceType !== "Other",
      validation: (rule) => rule.max(40),
    }),
    defineField({
      name: "createdByMe",
      title: "Written / created by me",
      type: "boolean",
      initialValue: false,
      description: "Turn on only for your original work, including books you have written. This adds the entry to the Written by me filter. Leave off for books you read, courses you take, and certifications you earn.",
    }),
    defineField({
      name: "authorCreator",
      title: "Author / creator",
      type: "string",
      validation: (rule) => rule.max(120),
    }),
    defineField({
      name: "coverImage",
      title: "Cover image / thumbnail",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alternative text",
          type: "string",
          description: "Briefly describe the cover for screen-reader users.",
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      validation: (rule) => rule.required().max(60),
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [defineArrayMember({ type: "string", validation: (rule) => rule.max(40) })],
      options: { layout: "tags" },
      validation: (rule) => rule.unique().max(12),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: ["Want to Learn", "Currently Learning", "Completed", "In Progress", "Published"],
        layout: "radio",
      },
      initialValue: "Want to Learn",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "progress",
      title: "Progress percentage",
      description: "Learning or creation progress. Use 100 for completed or published work.",
      type: "number",
      initialValue: 0,
      validation: (rule) => rule.required().integer().min(0).max(100),
    }),
    defineField({
      name: "rating",
      title: "Rating (out of 5)",
      type: "number",
      description: "Optional. Half-star ratings are supported.",
      options: { list: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] },
      validation: (rule) => rule.min(1).max(5).precision(1),
    }),
    defineField({
      name: "startDate",
      title: "Start date",
      type: "date",
    }),
    defineField({
      name: "finishDate",
      title: "Finish date",
      type: "date",
      validation: (rule) =>
        rule.custom((finishDate, context) => {
          const startDate = context.document?.startDate;
          if (!finishDate || !startDate || finishDate >= startDate) return true;
          return "Finish date must be on or after the start date.";
        }),
    }),
    defineField({
      name: "description",
      title: "Short description",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required().min(20).max(400),
    }),
    defineField({
      name: "personalSummary",
      title: "Personal summary / thoughts",
      type: "array",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "Heading 2", value: "h2" },
            { title: "Heading 3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
        }),
      ],
    }),
    defineField({
      name: "keyTakeaways",
      title: "Key takeaways",
      type: "array",
      of: [defineArrayMember({ type: "string", validation: (rule) => rule.max(240) })],
      validation: (rule) => rule.unique().max(20),
    }),
    defineField({
      name: "studyLog",
      title: "Study log",
      description:
        "Log each step of the loop as you go: Read → Paraphrase → Note → Apply. Doing all four closes a loop on the website. Quizzes are retrieval practice: they earn XP by score and keep the streak. Today I Learned notes that point at this entry count as Note steps automatically.",
      type: "array",
      of: [
        defineArrayMember({
          name: "studySession",
          title: "Study session",
          type: "object",
          fields: [
            defineField({
              name: "date",
              title: "Date",
              type: "date",
              initialValue: () => new Date().toLocaleDateString("en-CA"),
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "step",
              title: "Step",
              type: "string",
              options: {
                list: [
                  { title: "Read: took in new material", value: "Read" },
                  { title: "Paraphrase: put it in my own words", value: "Paraphrase" },
                  { title: "Note: captured what matters", value: "Note" },
                  { title: "Apply: used it for something real", value: "Apply" },
                  { title: "Quiz: tested myself on it", value: "Quiz" },
                ],
                layout: "radio",
              },
              initialValue: "Read",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "score",
              title: "Score",
              type: "number",
              description: "Questions answered correctly.",
              hidden: ({ parent }) => parent?.step !== "Quiz",
              validation: (rule) =>
                rule.integer().min(0).custom((score, context) => {
                  if (context.parent?.step !== "Quiz") return true;
                  if (score === undefined) return "Enter the score.";
                  const total = context.parent?.total;
                  return total === undefined || score <= total ? true : "Score can't be more than the total.";
                }),
            }),
            defineField({
              name: "total",
              title: "Out of",
              type: "number",
              hidden: ({ parent }) => parent?.step !== "Quiz",
              validation: (rule) =>
                rule.integer().min(1).max(100).custom((total, context) =>
                  context.parent?.step !== "Quiz" || total !== undefined ? true : "Enter the number of questions."),
            }),
            defineField({
              name: "where",
              title: "Where",
              type: "string",
              description: "Optional. For example: Ch. 4, pp. 80–112, Module 2.",
              validation: (rule) => rule.max(60),
            }),
            defineField({
              name: "minutes",
              title: "Minutes",
              type: "number",
              validation: (rule) => rule.integer().min(1).max(600),
            }),
            defineField({
              name: "entry",
              title: "In my own words",
              type: "text",
              rows: 4,
              description: "What you read, your paraphrase, the note, how you applied it, or (for a quiz) what you missed. Shown on the website.",
              validation: (rule) =>
                rule.max(600).custom((entry, context) =>
                  context.parent?.step === "Read" || entry?.trim() ? true : "Write a line or two for this step."),
            }),
          ],
          preview: {
            select: { step: "step", date: "date", where: "where", entry: "entry", score: "score", total: "total" },
            prepare({ step, date, where, entry, score, total }) {
              return {
                title: [step === "Quiz" && total ? `Quiz ${score ?? "?"}/${total}` : step, where].filter(Boolean).join(" · "),
                subtitle: [date, entry].filter(Boolean).join(" — "),
              };
            },
          },
        }),
      ],
    }),
    defineField({
      name: "externalUrl",
      title: "External resource URL",
      type: "url",
      validation: (rule) => rule.uri({ scheme: ["http", "https"] }),
    }),
    defineField({
      name: "featured",
      title: "Featured resource",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "displayOrder",
      title: "Display order",
      type: "number",
      description: "Optional. Lower numbers appear first among otherwise equal resources.",
      validation: (rule) => rule.integer().min(0).max(9999),
    }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "displayOrderAsc",
      by: [
        { field: "displayOrder", direction: "asc" },
        { field: "title", direction: "asc" },
      ],
    },
    {
      title: "Progress, highest",
      name: "progressDesc",
      by: [{ field: "progress", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      creator: "authorCreator",
      resourceType: "resourceType",
      createdByMe: "createdByMe",
      status: "status",
      media: "coverImage",
    },
    prepare({ title, creator, status, resourceType, createdByMe, media }) {
      return {
        title,
        subtitle: [resourceType, createdByMe ? "My work" : creator, status].filter(Boolean).join(" · "),
        media,
      };
    },
  },
});
