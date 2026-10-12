import { defineArrayMember, defineField, defineType } from "sanity";

export const learningNoteType = defineType({
  name: "learningNote",
  title: "Learning Note",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required().max(100),
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
      name: "publishedAt",
      title: "Published date",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "body",
      title: "What did you learn?",
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
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
              { title: "Code", value: "code" },
            ],
            annotations: [
              {
                name: "link",
                title: "Link",
                type: "object",
                fields: [
                  defineField({
                    name: "href",
                    title: "URL",
                    type: "url",
                    validation: (rule) => rule.uri({ scheme: ["http", "https"] }),
                  }),
                ],
              },
            ],
          },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      description: "Examples: Finance, AI, Technology, Markets, Books, or Life.",
      validation: (rule) => rule.required().max(60),
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [defineArrayMember({ type: "string", validation: (rule) => rule.max(40) })],
      options: { layout: "tags" },
      validation: (rule) => rule.unique().max(10),
    }),
    defineField({
      name: "relatedResource",
      title: "Learning from",
      type: "reference",
      description: "Connect this note to the book or course it came from. It then counts as a Note step in that entry's learning loop on the website.",
      to: [{ type: "learningResource" }],
    }),
    defineField({
      name: "featured",
      title: "Feature this note",
      type: "boolean",
      description: "Used as a tie-breaker when view counts are equal.",
      initialValue: false,
    }),
    defineField({
      name: "readTime",
      title: "Estimated read time in minutes",
      type: "number",
      description: "Optional. The website calculates this automatically when empty.",
      validation: (rule) => rule.integer().min(1).max(30),
    }),
  ],
  orderings: [
    {
      title: "Published date, newest",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      category: "category",
      resourceTitle: "relatedResource.title",
    },
    prepare({ title, category, resourceTitle }) {
      return {
        title,
        subtitle: [category, resourceTitle ? `From ${resourceTitle}` : ""].filter(Boolean).join(" · "),
      };
    },
  },
});
