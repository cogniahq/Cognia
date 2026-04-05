# Enterprise Deal Room Demo Corpus

This corpus is designed for a competition demo of Cognia's retrieval flow.

Theme:
- A fictional enterprise software deal between `Northstar Bank` and `Aperture Cloud`.

Recommended upload order:
1. `01_master_services_agreement.txt`
2. `02_data_processing_addendum.pdf`
3. `03_security_overview.pdf`
4. `04_service_level_agreement.txt`
5. `05_order_form_and_pricing.pdf`
6. `06_implementation_plan.docx`
7. `07_security_questionnaire_response.txt`
8. `08_customer_success_email_thread.txt`
9. `09_executive_steering_committee_notes.txt`
10. `10_sso_setup_guide.docx`

Mixed file types:
- `TXT` for quick scanning
- `PDF` for policy, security, and commercial proof points
- `DOCX` for implementation and identity setup walkthroughs

Run `./generate-rich-files.sh` to regenerate the demo `PDF` and `DOCX` files from the source text corpus before uploading.

Why this works well:
- Shared entities across docs
- Concrete dates, dollar amounts, and obligations
- Similar concepts phrased differently
- Policy, legal, commercial, technical, and email evidence in one corpus

See `demo-queries.md` for the highlighted competition queries and the full prompt list.
