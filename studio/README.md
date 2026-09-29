# Nick's Musings Studio

This private editorial workspace publishes articles to the `production` dataset in Sanity project `vzrug3c0`.

It also manages two connected learning collections:

- **Library Entry** — books, original work, courses, certifications, papers, videos, podcasts, and other material in the public Library. The stored document type remains `learningResource`, so existing content and note relationships are preserved.
- **Learning Note** — lightweight Today I Learned entries that can optionally reference a Learning Resource.

The relationship only needs to be selected on the Learning Note. The website automatically gathers every referencing note on its Resource page.

## Local use

```powershell
cd studio
npm run dev
```

Sign in with the Sanity account that owns the project. Create an Article, complete all required fields, generate its slug, and select **Publish**.

### Publish a Learning Resource

1. Open **Library Entry** and create a document.
2. Add the title, generate the slug, select its type and status, and provide a short description.
3. Set progress between 0 and 100. Add a rating, cover, thoughts, takeaways, dates, and an external link when useful.
4. Select **Publish**. It will appear at `/library`.

### Library filters and original work

- **Resource type** controls the public type filter. Books appear under Books; certifications appear under Certifications. Other types appear automatically once a matching entry is published.
- Turn on **Written / created by me** for your original work. This includes the entry in **Written by me** as well as its type filter. Existing entries default to off; nothing is assumed to be authored by Nick.
- For your own book, select **Book**, turn on **Written / created by me**, supply the author, and choose **In Progress** or **Published**. Progress can track creation; use 100 for published work.
- For an earned certification, select **Certification**, leave the original-work switch off, and use **Completed** with 100% progress. Add the credential link under **External resource URL**.
- To introduce a new type, select **Other** and enter **Custom resource type**, such as Essay or Project. Reuse exactly the same label on related entries. No frontend change is required.
- Filters show counts, work on touch and keyboard, and can be shared using the current page URL (for example `/library/?shelf=mine`). Empty collections show an explanation rather than a blank page.

### Publish a Learning Note

1. Open **Learning Note** and create a document.
2. Add the title, generate the slug, write the short body, and choose a category.
3. Optionally select a **Learning from** resource. Leave reading time blank to let the website calculate it.
4. Select **Publish**. It will appear at `/notes` and, when connected, on the related Resource page.

## Hosted Studio

```powershell
cd studio
npm run deploy
```

Sanity will prompt for a unique `*.sanity.studio` hostname during the first deployment.

Hosted Studio: `https://bynickthomas.sanity.studio/`
