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
