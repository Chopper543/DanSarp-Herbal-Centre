-- ============================================================================
-- SEED: 20 Blog Posts on Ghanaian Herbal Medicine, Wellness, and Health
-- ============================================================================
-- Prerequisite: At least one user with role 'super_admin' or 'admin' must exist.
-- Author for all posts: first super_admin or admin by created_at.
-- Status: published. Re-run is idempotent via ON CONFLICT (slug) DO UPDATE.
-- ============================================================================

INSERT INTO blog_posts (title, slug, excerpt, content, author_id, featured_image_url, status, published_at)
VALUES
  (
    'Introduction to Ghanaian Herbal Medicine',
    'introduction-to-ghanaian-herbal-medicine',
    'Ghana''s rich biodiversity has long supported a vibrant tradition of herbal medicine. This post introduces how plant-based remedies have been used for generations to support health and wellness across the country.',
    $p1$
**A Living Tradition**

Ghana's diverse landscapes—from coastal forests to northern savannas—host thousands of plant species used in traditional healing. Herbal medicine here is not a relic of the past but a living practice that continues to support the wellbeing of countless families. At DanSarp Herbal Centre, we honour this knowledge while offering safe, thoughtful guidance for those who wish to explore it.

[Image: Wide shot of a Ghanaian herbal market with baskets of dried herbs, roots, and barks]

**Herbs in Daily Life**

In many Ghanaian homes, herbs are part of everyday health: teas for digestion, leaves for skin, and roots prepared for specific needs. This tradition is passed down through families and trained practitioners. Understanding the basics helps you make informed choices and appreciate how these plants have earned their place in local wellness practices.

**Working With Your Healthcare Team**

Herbal remedies can complement modern healthcare when used thoughtfully. We encourage you to share any herbs or supplements you use with your doctor, especially if you are on other medicines or managing a health condition. This way, you can enjoy the benefits of Ghana's herbal heritage while staying safe.
$p1$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2020-01-15 09:15:00+00'::timestamptz
  ),
  (
    'The History and Tradition of Herbal Healing in Ghana',
    'history-tradition-herbal-healing-ghana',
    'Herbal healing in Ghana spans centuries, with knowledge passed orally and through practice. This article explores the origins and evolution of this tradition and its place in Ghanaian culture today.',
    $p2$
**Roots of a Rich Practice**

Long before formal clinics, communities across Ghana relied on local plants for health. Herbalists—often called *dɔkotera* or *odunsini* in different regions—learned from elders and from careful observation of nature. That knowledge was rarely written down; it lived in memory, in stories, and in the hands of those who prepared remedies for their neighbours.

[Image: Elder herbalist in traditional dress with dried herbs and roots in a woven basket]

**From Generation to Generation**

Apprenticeship has been the main path: young practitioners learn plant identification, preparation, and use from experienced healers. This oral tradition means that respect, secrecy around certain formulae, and the healer's reputation have always mattered. Today, some of this knowledge is being documented to preserve it for future generations while still honouring the role of traditional practitioners.

**Tradition and Change**

Modern Ghana has seen herbal medicine gain official recognition through initiatives like the *Centre for Scientific Research into Plant Medicine*. Traditional and modern approaches increasingly work alongside each other. At DanSarp, we value both the wisdom of the past and the importance of safety, quality, and dialogue with conventional healthcare.
$p2$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2020-05-22 14:30:00+00'::timestamptz
  ),
  (
    'Neem (Dogon Yaro): Benefits and Traditional Uses',
    'neem-dogon-yaro-benefits-traditional-uses',
    'Neem, known locally as Dogon Yaro, is a versatile tree whose leaves, bark, and seeds feature in many Ghanaian remedies. Learn about its traditional uses for skin, immunity, and dental care.',
    $p3$
**The multipurpose neem tree**

The neem tree (*Azadirachta indica*) grows in many parts of Ghana and is valued for its bitter leaves, bark, and seeds. In local practice, neem is often used for skin conditions, as a mouthwash, and to support general resilience. Its broad use has made it a staple in many household and herbalist preparations.

[Image: Fresh neem leaves and small twigs in a traditional Ghanaian bowl]

**Skin and topical use**

Neem leaves are commonly crushed or boiled for washes and pastes applied to the skin. Such preparations are traditionally used to soothe irritation and support skin hygiene. If you have sensitive skin or existing conditions, patch-test or seek advice before wider use.

**Dental and mouth care**

A simple neem twig or leaf rinse has long been used to support oral hygiene. The practice continues in many homes. For a gentle mouth rinse, some people steep a small handful of clean neem leaves in hot water, allow it to cool, and use it as a rinse. Always spit it out; do not swallow in large amounts.

**Using neem responsibly**

Neem is potent. Internal use of seeds or concentrated extracts can be harmful and should only be done under expert guidance. For day-to-day support, stick to mild preparations such as diluted leaf teas or topical use, and check with a healthcare provider if you are pregnant, breastfeeding, or on other medicines.
$p3$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2020-09-10 11:00:00+00'::timestamptz
  ),
  (
    'Moringa: The Miracle Tree of Ghana',
    'moringa-miracle-tree-ghana',
    'Moringa, with its nutrient-rich leaves and pods, is a cornerstone of Ghanaian herbal and culinary practice. Discover how it is used for energy, nutrition, and wellness in everyday life.',
    $p4$
**A tree of many uses**

Moringa (*Moringa oleifera*) is often called the "miracle tree" for good reason: its leaves, pods, and seeds are packed with vitamins, minerals, and protein. In Ghana, moringa is grown in many backyards and used in soups, sauces, and teas. It has become a go-to for families wanting to add more nutrients to their meals.

[Image: Fresh moringa leaves and green pods on a woven tray]

**Nutrition and energy**

Moringa leaves can be cooked like spinach, added to stews, or dried and powdered for smoothies and teas. The green pods (*drumsticks*) are cooked in soups and valued for their mild, nutritious flesh. Including moringa in a varied diet can help boost intake of iron, calcium, and vitamins—especially useful where balanced meals are harder to get.

**Lactation and postpartum**

In many Ghanaian communities, moringa leaves are given to new mothers to support milk supply and recovery. While traditions vary, the plant's nutritional profile makes it a sensible addition to postpartum meals. If you are breastfeeding, talk to your midwife or doctor before using large amounts or supplements.

**Simple ways to use moringa**

Add fresh leaves to *palava sauce*, *groundnut soup*, or rice dishes. For a quick tea, steep a teaspoon of dried leaf powder in hot water. Start with small amounts and increase gradually. Moringa is generally well tolerated when used as food; if you take concentrated supplements, follow the label and your healthcare provider's advice.
$p4$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2021-02-14 16:45:00+00'::timestamptz
  ),
  (
    'Aloe Vera in Ghanaian Traditional Medicine',
    'aloe-vera-ghanaian-traditional-medicine',
    'Aloe vera is a familiar plant in Ghanaian homes, used for skin, burns, and digestion. This post covers traditional uses and how to use it safely, both on the skin and internally.',
    $p5$
**The household healer**

Aloe vera grows easily in Ghana and is kept in many compounds for first aid and skin care. The thick gel inside the leaves is cooling and soothing, which is why it has long been used on minor burns, sunburn, and dry or irritated skin. It is one of the most accessible herbs for everyday use.

[Image: Potted aloe vera plant with a leaf cut open showing clear gel]

**Skin and minor burns**

For small burns or sunburn, a fresh slice of aloe leaf can be applied (gel side to skin) after the area has been cooled with water. The gel is also used for dry skin and minor scrapes. Use only the inner gel; the yellow latex near the rind can be harsh and is not meant for direct application. If a burn is large, blistered, or infected, seek medical care.

**Digestive use: a note of caution**

Aloe has a long history of internal use for digestion, but the latex in the leaf has strong laxative effects and can cause cramping or dependency with regular use. *Aloe vera gel* (the inner, clear part) is generally gentler, but internal use should be occasional and modest. If you have digestive issues, it is better to get a proper diagnosis than to rely on aloe alone.

**Growing and using your own**

Aloe needs little care: well-drained soil, some sun, and sparse watering. When you need it, cut a lower leaf, slice it lengthwise, and scoop out the gel. Store unused gel in the fridge for a few days. For prepared juices or supplements, choose reputable brands and follow the directions—and avoid internal use if you are pregnant or have kidney or digestive conditions unless your doctor approves.
$p5$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2021-06-08 08:00:00+00'::timestamptz
  ),
  (
    'Hibiscus (Sobolo/Bissap): Heart Health and More',
    'hibiscus-sobolo-bissap-heart-health',
    'Hibiscus, or sobolo, is the base of a beloved Ghanaian drink rich in antioxidants. Learn how this tart, refreshing plant is used for heart health, hydration, and wellness.',
    $p6$
**The drink of the gods**

Sobolo—made from the calyces of *Hibiscus sabdariffa*—is a tart, deep-red drink enjoyed across Ghana and West Africa. It is served cold, sometimes with ginger or spices, and is not only refreshing but also packed with compounds that support heart and metabolic health. In the heat of the day, a glass of sobolo is both a treat and a traditional tonic.

[Image: Glass of deep-red sobolo drink with dried hibiscus calyces in a small bowl beside it]

**Antioxidants and heart support**

Hibiscus is rich in antioxidants and has been studied for its effects on blood pressure and cholesterol. Drinking sobolo as part of a balanced diet may support healthy circulation. It is not a replacement for prescribed blood-pressure medicine; if you have hypertension, keep taking your medication and discuss sobolo with your doctor, as it can interact with some drugs.

**Making sobolo at home**

Rinse a handful of dried hibiscus calyces, then steep in boiling water for 10–15 minutes. Strain, sweeten lightly if you like (honey or a little sugar), and chill. Add ginger, mint, or cloves for extra flavour. Avoid brewing or storing in reactive metal pots to keep the colour and taste bright.

**Who should take care**

Hibiscus may affect blood pressure and hormone-sensitive conditions. If you are on blood-pressure or diuretic medicines, or if you are pregnant, talk to your healthcare provider before drinking large amounts of sobolo or taking hibiscus supplements.
$p6$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2021-11-20 13:22:00+00'::timestamptz
  ),
  (
    'Prekese (Tetrapleura tetraptera): Uses and Benefits',
    'prekese-tetrapleura-tetraptera-uses-benefits',
    'Prekese, the aromatic fruit of the Tetrapleura tetraptera tree, flavours soups and remedies across Ghana. Discover its use in cooking, postpartum care, and traditional wellness.',
    $p7$
**The aromatic pod**

Prekese is the fruit pod of *Tetrapleura tetraptera*, a tree found in Ghana's forests. The dried pods add a distinct, slightly sweet aroma to soups—especially *palm nut* and *Kontomire*—and are also used in herbal preparations. In many homes, the smell of prekese boiling in a pot is a sign of a nourishing, traditional meal.

[Image: Dried prekese pods on a wooden surface next to a mortar and pestle]

**In the kitchen**

A piece of prekese pod is typically added to soups—such as *palm nut* and *Kontomire*—and allowed to simmer; it is removed before serving. It contributes depth and a subtle sweetness. The seeds inside can be ground and used in small amounts. If you are new to prekese, start with a small piece and increase to taste.

**Postpartum and circulation**

In Ghanaian tradition, prekese is often included in soups and preparations for new mothers, to support recovery and milk supply. It is also used in remedies aimed at supporting circulation and general strength. These uses are based on long experience; if you are postpartum or have health concerns, it helps to combine tradition with guidance from your midwife or doctor.

**Using prekese safely**

Prekese is generally used in culinary amounts. For medicinal preparations, use only under the guidance of someone experienced. If you have diabetes or are on blood-sugar or blood-pressure medicines, discuss prekese use with your healthcare provider, as it may interact with some treatments.
$p7$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2022-03-05 10:30:00+00'::timestamptz
  ),
  (
    'Dawadawa and Gut Health: A Ghanaian Perspective',
    'dawadawa-gut-health-ghanaian-perspective',
    'Dawadawa, the fermented seeds of the African locust bean, is a traditional flavour and a source of beneficial bacteria. Learn how it supports gut health and adds depth to Ghanaian dishes.',
    $p8$
**Fermented flavour and function**

Dawadawa is made by fermenting the seeds of the African locust bean tree (*Parkia biglobosa*). The process produces a strong-smelling, umami-rich condiment that seasons soups, stews, and sauces across northern Ghana and the Sahel. Beyond flavour, fermentation encourages the growth of bacteria that can support a healthy gut.

[Image: Dawadawa balls or paste on a plate with a traditional bowl of soup]

**Gut-friendly fermentation**

Like other fermented foods, dawadawa can contribute to the diversity of bacteria in the digestive system. A varied, fibre-rich diet plus fermented foods like dawadawa may support digestion and comfort. It is best seen as part of an overall healthy diet, not a cure for specific gut diseases.

**Adding dawadawa to meals**

Dawadawa is usually added in small amounts to soups and stews early in cooking so its flavour mellows. It can be used as paste or in dried, ground form. A little goes a long way. If you are new to it, start with a small quantity and increase as you get used to the taste.

**Considerations**

Dawadawa is high in sodium, so use it in moderation if you are watching your salt intake. Some people may be sensitive to strongly fermented foods; if you experience discomfort, reduce the amount or avoid it. As with any change in diet, it can help to introduce it gradually.
$p8$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2022-07-18 15:00:00+00'::timestamptz
  ),
  (
    'Ginger and Turmeric: Ghana''s Warming Herbs',
    'ginger-turmeric-ghana-warming-herbs',
    'Ginger and turmeric are kitchen staples in Ghana, used in teas, soups, and remedies for digestion and inflammation. Here is how to make the most of these warming, versatile roots.',
    $p9$
**Kitchen medicine**

Ginger and turmeric grow in Ghana and appear in everything from *waakye* and soups to teas and homemade remedies. Both have a long history of use for digestion, circulation, and soothing minor aches. Having them on hand makes it easy to add a wellness boost to daily meals and drinks.

[Image: Fresh ginger and turmeric roots on a cutting board with a cup of golden turmeric tea]

**Ginger: digestion and nausea**

Ginger is widely used to ease nausea, motion sickness, and mild stomach discomfort. A simple tea—slices of fresh ginger steeped in hot water—is a go-to in many homes. Ginger also adds warmth to soups and stews and can be chewed in small pieces for travel sickness. If you have a sensitive stomach, start with a weak tea and increase strength gradually.

**Turmeric: colour and comfort**

Turmeric gives golden colour and a mild, earthy taste to dishes. It is also used in teas and pastes for its soothing properties. *Curcumin*, its main active compound, is better absorbed with a little fat and black pepper—so adding turmeric to cooked meals or warm milk with a pinch of pepper makes sense. Turmeric can stain surfaces and skin; handle with care.

**Simple ginger–turmeric tea**

Simmer a few slices of fresh ginger and turmeric in water for 10–15 minutes. Strain, add honey or lemon if you like, and drink warm. This is a comforting drink on cool days or when you want something soothing. If you take blood thinners or have gallbladder issues, talk to your doctor before using large amounts of turmeric or ginger in a medicinal way.
$p9$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2022-12-01 09:45:00+00'::timestamptz
  ),
  (
    'Scent Leaf (Nchanwu): Immune and Respiratory Support',
    'scent-leaf-nchanwu-immune-respiratory',
    'Scent leaf, or nchanwu, is a fragrant herb used in Ghana for colds, congestion, and general wellness. Learn how to use it in teas and light preparations for immune and respiratory support.',
    $p10$
**A fragrant household herb**

Scent leaf (*Ocimum gratissimum*)—*nchanwu* in Igbo, and known by similar names across West Africa—is a aromatic shrub with a strong, pleasant smell. In Ghana, it is used in soups, as a tea, and in steam inhalations to ease congestion and support the body during colds. Its scent alone is part of why it feels so comforting when you are under the weather.

[Image: Fresh scent leaf sprigs in a small basket with a steaming cup of tea]

**Teas and steams**

A simple scent-leaf tea is made by steeping a few fresh or dried leaves in hot water. Many find it helpful when they have a runny nose or cough. Some people also add the leaves to a bowl of hot water and breathe in the steam (at a safe distance to avoid burns) to clear the nose. Use only the leaves; avoid strong, concentrated extracts unless advised by a practitioner.

**In the kitchen**

Scent leaf is used in *pepper soup*, *efo*, and other dishes. Cooking tones down the intensity while keeping the flavour. Including it in meals is an easy way to enjoy its benefits as part of normal eating.

**Using scent leaf safely**

Scent leaf is generally used in food and tea amounts. Pregnant women and those on blood-sugar or blood-pressure medicines should use it in moderation and, if in doubt, check with a healthcare provider. For serious respiratory illness, always seek medical care; herbs can support comfort but are not a substitute for proper diagnosis and treatment.
$p10$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2023-01-25 14:15:00+00'::timestamptz
  ),
  (
    'Papaya Leaves and Seeds: Beyond the Fruit',
    'papaya-leaves-seeds-beyond-fruit',
    'Papaya is valued in Ghana for its fruit, but the leaves and seeds also have a place in traditional use. This post covers how they are used for digestion and topical support, and when to be cautious.',
    $p11$
**More than the fruit**

Papaya grows widely in Ghana, and while the fruit is a favourite, the leaves and seeds have their own role in home remedies. Leaf teas and poultices are used for digestion and skin; the seeds are sometimes used in small amounts for their pungent, enzyme-rich character. Knowing how to use them—and when to avoid them—helps you stay safe.

[Image: Papaya fruit with a few leaves and seeds on a woven mat]

**Papaya leaf tea**

Papaya leaves contain *papain* and other enzymes. A mild leaf tea is traditionally used to support digestion and appetite. Use only a few, clean, mature leaves per cup; steeping for 5–10 minutes is enough. Do not use green, unripe fruit or large amounts of leaves. *Pregnant women should avoid papaya leaf and unripe papaya*, as they may stimulate the uterus. If you are on blood thinners or have a latex allergy, talk to your doctor before using papaya leaf.

**Seeds: sparing use**

Papaya seeds are strong and peppery. In some traditions, a few crushed seeds are used occasionally for digestive or other purposes. They can be harsh and should not be used in large quantities or by pregnant women or young children. When in doubt, stick to the fruit and avoid the seeds unless a skilled practitioner advises otherwise.

**Topical use**

Crushed papaya leaves or the sap are sometimes applied to minor skin issues. The sap can be irritating; use only in small amounts and avoid open wounds or broken skin. For any persistent skin problem, see a healthcare provider.
$p11$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2023-04-12 11:30:00+00'::timestamptz
  ),
  (
    'Bitter Leaf (Aworowono): Uses in Traditional Care',
    'bitter-leaf-aworowono-traditional-care',
    'Bitter leaf is a staple in Ghanaian cooking and traditional medicine. Learn how it is prepared to reduce bitterness, and how it is used for blood sugar, digestion, and general wellness.',
    $p12$
**The bitter that does good**

Bitter leaf (*Vernonia amygdalina*)—*aworowono* or *ebevu* in Ghana—is exactly what its name says: bitter. That bitterness is part of its traditional appeal. It is used in soups, as a vegetable, and in herbal preparations aimed at digestion, blood sugar, and cleansing. Proper preparation makes it much more palatable while keeping its place in both kitchen and remedy cabinet.

[Image: Bunch of fresh bitter leaf with a bowl of washed, squeezed leaves ready for cooking]

**Reducing the bitterness**

Before cooking, the leaves are usually washed, bruised, and squeezed repeatedly in water to remove much of the bitter taste. The squeezed leaves are then used in *kontomire* stew, *light soup*, or other dishes. This process is important for both flavour and, in some views, for moderating the strength of the plant.

**Traditional uses**

Bitter leaf is used in Ghanaian tradition to support digestion, appetite, and blood sugar. Research has looked at its potential in these areas, but it is not a substitute for a healthy diet or prescribed diabetes care. If you have diabetes, keep taking your medication and work with your doctor before relying on bitter leaf for blood-sugar control.

**A balanced view**

Bitter leaf is nutritious and can be part of a healthy diet when prepared well. Use it as food in normal amounts. For stronger or concentrated preparations, seek guidance. Pregnant women and people on blood-sugar or blood-pressure medicines should use it in moderation and, if unsure, check with a healthcare provider.
$p12$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2023-08-30 16:00:00+00'::timestamptz
  ),
  (
    'Coconut and Palm: Oils and Healing in Ghana',
    'coconut-palm-oils-healing-ghana',
    'Coconut and palm are central to Ghanaian food and body care. This article explores how their oils and other parts are used for skin, hair, cooking, and wellness in daily life.',
    $p13$
**Oils of life**

Coconut and palm trees are everywhere in Ghana—along the coast and in many inland areas. Their oils, milk, and other parts are used in cooking, for skin and hair, and in traditional remedies. From *red red* to body creams, these plants are deeply woven into Ghanaian life and wellness.

[Image: Fresh coconuts and a bottle of red palm oil on a wooden table]

**Coconut: skin, hair, and kitchen**

Coconut oil is used to moisturise skin and hair, especially in dry or sunny weather. It is also a cooking oil and the base for many home-made body preparations. Coconut water from young nuts is a refreshing, electrolyte-rich drink. When buying oil, choose unrefined, cold-pressed versions when possible for both cooking and skin care.

**Palm oil: nutrition and tradition**

Red palm oil is a staple in Ghanaian cooking and is rich in vitamin A and other nutrients. It gives colour and flavour to soups, stews, and sauces. In some traditions, it is also used on the skin and in hair care. Use it in moderation as part of a varied diet; balance it with other healthy fats and vegetables.

**Using oils wisely**

Both oils are generally safe for topical and culinary use in normal amounts. If you have very oily or acne-prone skin, use coconut oil sparingly on the face. For heart health, focus on overall diet and lifestyle; palm and coconut can be part of that when used in balance. Choose sustainably produced palm oil when you can, to support both health and the environment.
$p13$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2024-02-08 08:30:00+00'::timestamptz
  ),
  (
    'Honey and Propolis in Ghanaian Remedies',
    'honey-propolis-ghanaian-remedies',
    'Honey and propolis have long been used in Ghana for coughs, wound support, and energy. Learn how to choose and use them safely at home and when to avoid them.',
    $p14$
**The gifts of the hive**

Honey is a cherished food and remedy in Ghana—used in teas for coughs, as a natural sweetener, and sometimes on small wounds. Propolis, the resin that bees use to seal the hive, is used in some preparations for its antimicrobial properties. Together, they offer simple, time-tested support for everyday wellness.

[Image: Jar of golden honey with a honeycomb piece and a teaspoon]

**Honey for coughs and throats**

A spoon of honey, or honey in warm water or tea, can soothe a sore throat and ease a tickly cough. It is a common choice for children over one year old and adults. *Never give honey to babies under one year*—it can contain bacteria that cause infant botulism. For persistent coughs or breathing problems, see a doctor.

**Wound and skin use**

Honey has been used on minor cuts and burns for its soothing and protective qualities. Only use a small amount on clean, small wounds; for anything deeper, infected, or slow to heal, get medical help. Store honey in a cool, dry place and avoid adding water to the jar, as this can encourage fermentation.

**Propolis and other hive products**

Propolis is available in tinctures, lozenges, and creams. Use only products from trusted sources and follow the label. If you are allergic to bee stings or hive products, avoid propolis. As with any new supplement, it is wise to discuss it with your healthcare provider, especially if you are on other medicines.
$p14$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2024-05-15 12:45:00+00'::timestamptz
  ),
  (
    'Herbal Approaches to Stress and Mental Wellness',
    'herbal-approaches-stress-mental-wellness',
    'Stress and low mood are common, and herbs can offer gentle support. This post looks at calming teas, better sleep, and lifestyle habits that complement Ghanaian herbal traditions.',
    $p15$
**Gentle support for busy minds**

Stress, anxiety, and poor sleep affect many of us. Herbs cannot replace professional care for serious mental health issues, but they can be part of a broader approach: calming teas, better sleep habits, and small daily rituals. In Ghana, plants like lemongrass, *scent leaf*, and **ginger** are often part of that picture.

[Image: Cup of herbal tea and fresh herbs on a quiet table with soft morning light]

**Calming teas**

Teas made from lemon grass, mint, or scent leaf are caffeine-free and can help you slow down in the evening. A simple recipe: steep a few sprigs of fresh or dried herb in hot water for 5–10 minutes. Add a little honey if you like. Sipping slowly is as important as the herbs themselves—it gives your nervous system a chance to settle.

**Sleep and rhythm**

Herbs work best when combined with good sleep habits: a regular bedtime, a dark and quiet room, and less screen time before bed. A warm, non-caffeinated tea an hour before sleep can be a useful signal that the day is ending. If you have lasting insomnia or low mood, please reach out to a doctor or counsellor; they can help in ways that herbs alone cannot.

**Lifestyle and community**

Movement, time outdoors, and connection with others all support mental wellness. Herbal teas and rituals can support that—they are part of caring for yourself, not a substitute for rest, relationships, or professional help when you need it.
$p15$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2024-10-22 10:00:00+00'::timestamptz
  ),
  (
    'Digestive Health: Herbs for Stomach and Gut',
    'digestive-health-herbs-stomach-gut',
    'Digestive discomfort is common, and Ghanaian herbal tradition offers several gentle options. Discover how ginger, mint, dawadawa, and simple dietary habits can support your stomach and gut.',
    $p16$
**Soothing from the inside out**

Bloating, indigestion, and occasional constipation are often manageable with diet and mild herbs. In Ghana, ginger, mint, *dawadawa*, and *prekese* are among the plants used to support digestion. They work best as part of a balanced diet, good hydration, and healthy eating habits.

[Image: Fresh ginger, mint leaves, and a cup of ginger tea on a wooden tray]

**Ginger and mint**

Ginger tea is a go-to for nausea and a heavy stomach: slice fresh ginger, steep in hot water, and sip. Mint tea can ease bloating and cramping for some people. Both are safe in food and tea amounts. If symptoms persist or you have pain, bleeding, or weight loss, see a doctor to rule out serious conditions.

**Fermented foods and fibre**

Dawadawa and other fermented foods can support a diverse, healthy gut. So can fibre from vegetables, fruits, and whole grains. Increase fibre and new foods gradually to avoid extra gas or discomfort. Drinking enough water helps fibre do its job.

**When to seek help**

Herbs and diet can support everyday digestion, but they are not a substitute for medical care. If you have persistent heartburn, changes in bowel habits, blood in stool, or unexplained pain, get a proper diagnosis. Your doctor can help you combine conventional treatment with sensible use of herbs and diet.
$p16$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2025-01-10 15:30:00+00'::timestamptz
  ),
  (
    'Skin and Wound Care: Traditional Herbal Practices',
    'skin-wound-care-traditional-herbal-practices',
    'Neem, aloe, honey, and other plants have long been used in Ghana for skin and minor wounds. Learn simple, safe practices and when it is important to see a healthcare provider.',
    $p17$
**Plants that nurture the skin**

Ghanaian tradition has a rich repertoire for skin care and minor wounds: neem for washes and pastes, aloe for burns and dryness, honey for small cuts. Used correctly, these can support healing and comfort. Cleanliness and knowing when to seek care are just as important as the herbs themselves.

[Image: Aloe leaf, small jar of honey, and neem leaves arranged on a clean cloth]

**Neem for skin**

Neem leaf washes or pastes are used for skin irritation and hygiene. Keep preparations mild and use on intact skin. If you have open wounds, eczema, or known sensitivity, patch-test or ask a practitioner before wider use. Do not use neem seed oil or strong extracts on skin without guidance.

**Aloe and honey**

Aloe gel can soothe minor burns, sunburn, and dry skin. Honey is sometimes used on small, clean wounds for its soothing and protective qualities. Use only a small amount; cover with a clean dressing. For any wound that is deep, dirty, or showing signs of infection (redness, swelling, pus, fever), see a doctor. Do not put honey or aloe on serious burns—cool with water and get medical help.

**Cleanliness and care**

Whatever you apply, the area should be clean. Wash your hands before handling wounds. Use clean utensils and containers. If you are caring for someone else, take care to avoid spreading infection. Traditional knowledge and basic hygiene work best together.
$p17$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2025-06-28 09:00:00+00'::timestamptz
  ),
  (
    'Women''s Health and Herbal Traditions in Ghana',
    'womens-health-herbal-traditions-ghana',
    'From pregnancy to postpartum, Ghanaian herbal tradition has much to offer women. This post explores supportive plants like prekese and moringa, and the importance of balancing tradition with modern care.',
    $p18$
**Honouring women's wellness**

Women''s health—pregnancy, childbirth, postpartum, and daily wellbeing—has always been at the heart of Ghanaian herbal practice. Plants like *prekese*, *moringa*, and *scent leaf* are used to support new mothers, milk supply, and recovery. These traditions are valuable; they work best when combined with skilled maternity care and your doctor's advice.

[Image: Fresh moringa leaves and prekese in a traditional bowl, with a cup of tea]

**Postpartum support**

Soups and teas made with prekese, moringa, and other nutritious plants are commonly given to new mothers to aid recovery and lactation. Such foods can be nourishing and comforting. If you are postpartum, work with your midwife or doctor to ensure your diet meets your needs and does not clash with any health conditions or medicines.

**Pregnancy: caution first**

*Many herbs that are fine at other times should be avoided or reduced in pregnancy.* Papaya leaf, strong neem preparations, and some other plants can be harmful. Stick to gentle, well-known foods and only use herbal remedies when a knowledgeable practitioner or your doctor has approved them. When in doubt, avoid.

**Routine wellness**

For everyday support—energy, digestion, skin—the same principles apply: use food and mild preparations, and avoid strong or unknown herbs when pregnant or breastfeeding. Your healthcare team can help you choose what is safe for you and your baby.
$p18$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2025-11-05 14:00:00+00'::timestamptz
  ),
  (
    'Children''s Wellness: Safe Herbal Use at Home',
    'childrens-wellness-safe-herbal-use',
    'Herbs can support children''s health when used carefully. This post covers gentle options, what to avoid, and when to rely on a healthcare professional instead of home remedies.',
    $p19$
**Gentle care for little ones**

Children have smaller bodies and can be more sensitive to herbs. In Ghanaian homes, mild teas, simple foods, and careful topical use are common. The key is to choose gentle options, use small amounts, and know when to seek a doctor. This post offers general guidance; your paediatrician knows your child best.

[Image: Child-friendly herbal tea in a small cup with fresh mint and a piece of fruit]

**Safe choices**

Mild teas from *mint*, *lemongrass*, or *ginger* (well diluted) are often used for slight digestive upset or restlessness. *Honey can be used for coughs only in children over one year.* For younger babies, avoid honey and strong herbs. Use only a small amount of any herb and watch for reactions. If in doubt, skip it.

**What to avoid**

Avoid strong, bitter, or purgative herbs in children. Do not give concentrated extracts, essential oils by mouth, or adult doses. *Neem* internally, *papaya leaf*, and *bitter leaf* in large amounts are not suitable for young children. When they are ill, do not delay medical care in the hope that herbs alone will fix it.

**When to see a doctor**

Fever, difficulty breathing, persistent vomiting or diarrhoea, rash, or a child who is much less active or difficult to wake need prompt medical attention. Herbs can sometimes support comfort alongside treatment, but only with your doctor's knowledge. When in doubt, ask.
$p19$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2026-03-14 11:15:00+00'::timestamptz
  ),
  (
    'Integrating Traditional Herbs into Modern Life',
    'integrating-traditional-herbs-modern-life',
    'You can enjoy Ghana''s herbal heritage in a busy, modern life. This post offers practical ideas: kitchen staples, simple teas, and how to balance traditional herbs with conventional healthcare.',
    $p20$
**Making tradition work today**

Ghana's herbal tradition does not have to live only in the past. With a few staples and simple habits, you can bring it into a modern, busy life. This post suggests easy ways to start: herbs in the kitchen, teas in the evening, and a balanced approach that respects both tradition and conventional medicine.

[Image: Modern kitchen counter with fresh herbs, a teapot, and a small bowl of moringa powder]

**Kitchen staples**

Keep *ginger*, *turmeric*, *moringa* (fresh or powder), and *scent leaf* on hand. Add them to everyday meals: ginger in stir-fries, turmeric in rice, moringa in soups or smoothies, scent leaf in stews. You do not need special recipes—small, regular additions add up and connect you to familiar flavours and benefits.

**Simple teas**

A cup of ginger, hibiscus, or mint tea can become a daily ritual. Make a big batch of sobolo or ginger tea and keep it in the fridge. In the evening, a caffeine-free herbal tea can help you wind down. These are small acts of care that fit easily into a full schedule.

**Balancing with conventional care**

Use herbs to *complement* professional healthcare, not replace it. Tell your doctor what herbs and supplements you use. For chronic conditions, pregnancies, and children, get advice before adding new remedies. Tradition and modern medicine can work together when we use both with care and respect.
$p20$,
    (SELECT id FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1),
    NULL,
    'published',
    '2026-07-20 16:30:00+00'::timestamptz
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  author_id = EXCLUDED.author_id,
  featured_image_url = EXCLUDED.featured_image_url,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at,
  updated_at = NOW();
