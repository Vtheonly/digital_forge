# Cinematic Visual Direction

Do not simply animate text on a flat background. The video should feel like a premium commercial created by a professional motion design studio.

Use modern 3D-inspired visuals wherever appropriate. Incorporate technologies such as Three.js, GSAP, SVG, Canvas, WebGL, or similar libraries to create depth, lighting, and cinematic motion. The goal is not to showcase technology, but to create a visually stunning final result.

Every scene should have depth and movement. Simulate a virtual camera rather than a static viewport.

Use cinematic camera movements such as:

* Slow push-ins
* Smooth pull-backs
* Orbital rotations around objects
* Dynamic pans
* Perspective shifts
* Focus transitions
* Parallax layers
* Floating camera movement

The camera should almost never remain perfectly still.

## Product Visualizations

Whenever a service is introduced, visualize it instead of simply displaying text.

### Mobile Apps

Show a premium smartphone floating in 3D space.

Animate:

* Device rotating slowly
* Screen content assembling itself
* UI cards sliding into place
* Buttons responding to interaction
* Notifications appearing
* Light reflections moving across the glass
* Smooth camera orbit around the device

### Websites

Show a modern browser window or laptop emerging from the scene.

Animate:

* Hero sections building themselves
* Components snapping into place
* Cards expanding
* Smooth scrolling
* Cursor interactions
* Responsive layouts
* Subtle camera movement around the interface

### Desktop Applications

Present a desktop monitor or application window with depth.

Animate:

* Windows unfolding
* Panels expanding
* Charts and dashboards loading
* Graphs animating
* Navigation transitions
* Floating interface elements

### AI Solutions

Represent AI visually rather than with generic icons.

Examples include:

* Neural networks forming
* Data particles flowing
* Connected nodes
* Intelligent pipelines
* Digital brains
* Abstract computation
* Dynamic data visualization
* Streams of information transforming into useful results

Everything should feel intelligent and alive.

### Business Automation

Show automated workflows instead of text.

Examples include:

* Flow diagrams
* API connections
* Data pipelines
* Tasks moving automatically
* Documents processing themselves
* Connected business systems
* Real-time synchronization

The animation should immediately communicate automation.

## Motion Language

Every object should feel physically present.

Use smooth easing, realistic acceleration, momentum, anticipation, overshoot, and subtle secondary motion. Objects should glide naturally rather than simply appearing or disappearing.

Cards can:

* Fold open
* Stack
* Flip
* Expand
* Morph
* Separate
* Assemble

Icons can:

* Draw themselves
* Rotate into place
* Build from particles
* Burst apart
* Reassemble

Background elements should move continuously with subtle, elegant motion.

## Premium Visual Quality

The final video should resemble a high-end technology advertisement from companies such as Apple, Stripe, Linear, Notion, Vercel, or modern SaaS startups.

Aim for:

* Cinematic lighting
* Soft reflections
* Glassmorphism
* Ambient glows
* Dynamic gradients
* Floating geometric elements
* Clean shadows
* Depth of field
* Layered composition

Everything should feel handcrafted, premium, and visually expensive.

## Brand Identity

The entire video should reinforce one consistent visual identity.

Brand: **Digital Forge**

Brand personality:

* Modern
* Premium
* Engineering-focused
* Innovative
* Minimal
* Elegant
* Confident
* High-tech

Every scene should feel like part of the same visual language, with consistent colors, typography, motion style, lighting, spacing, and transitions.

The viewer should immediately feel that Digital Forge creates world-class software products, including websites, mobile applications, desktop applications, AI solutions, automation systems, and custom software built specifically for businesses.




i had a proejct befoere that takes html and turns then to picture and isntgram psots

the prompt then :"""

I build custom apps, websites, and tools for anyone who needs them—whether you’re running a small business, starting something new, or just have a cool idea you want to bring to life.I build for all platforms (except MacOS and iOS, but don’t mention that).

A delivery app for your local store,A website for your brand or project,A simple system to manage your team or orders,Big or small—startup or side hustle—anything.

So I made an Instagram page for myself for social presence and called it Digital Forge Dev, which is also my service name from now on. I want to make announcements and posts, and I want to create those kinds of announcement-style images—the 1:1 Instagram post format (these are only templates as examples of what I want to do; I want to make similar scenes, but in the context of developing digital products and...)

Make an announcement-style images in 1:1 Instagram post format about Digital Forge Dev

Since you can't generate actual images, my idea is to build Instagram-style promotional visuals directly with code—using HTML, CSS, and React components—so I can later screenshot the layout and turn it into a clean, square-format image for Instagram.

When I say “make an Instagram post,” I don’t mean writing captions or publishing on the platform itself.What I mean is:Design the visual content that would appear in the post—like a digital poster or announcement—entirely in code.

I want to recreate promotional visuals in code instead of using tools like Figma or Photoshop. The layout should look and feel like the examples I provided, which include elements such as:

A heading or slogan (e.g., “Your Vision, Realized”)

A short, engaging paragraph (value proposition or mission)

Visual feature items or checkmarks with concise statements

Sometimes a grid of service cards (e.g., 2x2 layout)

A gradient or clean, minimal background

Everything structured as a component or standalone webpage

The goal is to make these as code-based layouts that visually resemble polished announcement posters. Once the layout is complete, I’ll capture it as a screenshot (in a 1:1 square aspect ratio) and use that as an image post on Instagram.

theses are example of what i want:

Here is the complete example, final, and fully corrected code for the entire carousel.

الصورة 1 من 7: الغلاف (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 1 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        h1 { font-weight: 900; font-size: 80px; margin: 0 0 50px 0; line-height: 1.4; }
        .swipe-prompt { font-size: 32px; font-weight: 700; color: #fff; opacity: 0.8; border: 2px solid rgba(255,255,255,0.5); padding: 15px 30px; border-radius: 50px; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <h1>هل يمتلك عملك الحضور الرقمي الذي يستحقه؟</h1>
            <div class="swipe-prompt">← اسحب لتعرف لماذا</div>
        </div>
    </div>
</body>
</html>

الصورة 2 من 7: بناء المصداقية (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 2 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">✨</div>
            <h2>بناء المصداقية والثقة فورًا</h2>
            <p>الموقع الإلكتروني الاحترافي هو واجهة متجرك العصرية. إنه يثبت أنك عمل جاد وشرعي يمكن للعملاء الوثوق به.</p>
        </div>
        <div class="footer">١ / ٦</div>
    </div>
</body>
</html>

الصورة 3 من 7: الوصول لجمهور عالمي (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 3 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">🌍</div>
            <h2>الوصول لجمهور عالمي</h2>
            <p>تحرر من حدود موقعك الجغرافي. حضورك الرقمي يفتح أبوابك للعملاء في مدينتك، بلدك، أو حتى حول العالم.</p>
        </div>
        <div class="footer">٢ / ٦</div>
    </div>
</body>
</html>

الصورة 4 من 7: عملك مفتوح 24/7 (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 4 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">🕒</div>
            <h2>عملك "مفتوح" على مدار الساعة</h2>
            <p>موقعك الإلكتروني يعمل من أجلك حتى عندما لا تعمل. يجيب على الأسئلة، يجمع بيانات العملاء المحتملين، ويحقق المبيعات في أي وقت.</p>
        </div>
        <div class="footer">٣ / ٦</div>
    </div>
</body>
</html>

الصورة 5 من 7: استعراض المنتجات (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 5 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">🖼️</div>
            <h2>استعراض منتجاتك وخدماتك</h2>
            <p>تجاوز مجرد الوصف البسيط. استخدم مساحة مخصصة لتُظهر لعملائك ما الذي يجعل عروضك فريدة ومميزة.</p>
        </div>
        <div class="footer">٤ / ٦</div>
    </div>
</body>
</html>

الصورة 6 من 7: اكتساب رؤى قيمة (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 6 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">📈</div>
            <h2>تواصل واكتسب رؤى قيّمة</h2>
            <p>تفاعل مباشرة مع جمهورك واحصل على بيانات قيمة حول من هم عملاؤك وماذا يريدون حقًا.</p>
        </div>
        <div class="footer">٥ / ٦</div>
    </div>
</body>
</html>

الصورة 7 من 7: الدعوة لاتخاذ إجراء (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 7 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; margin-bottom: 50px; }
        .cta-button { font-size: 34px; font-weight: 700; color: #111827; background-color: #fff; padding: 25px 60px; border-radius: 20px; text-decoration: none; transition: transform 0.2s ease; }
        .cta-button:hover { transform: scale(1.05); }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">🏆</div>
            <h2>هل أنت مستعد للتميز؟</h2>
            <p>الحضور الرقمي القوي لم يعد رفاهية—بل ضرورة. لنبني حضورك الرقمي معًا.</p>
            <a href="#" class="cta-button">ابدأ مشروعك اليوم</a>
        </div>
    </div>
</body>
</html>

""""

end of the old promptnow i want to do the same buf for video reels in htmla

Your prompt is optimized for educational explainers, not for short-form social media. Instagram Reels and TikTok have completely different pacing, framing, typography, and attention-retention patterns.

Here's a version redesigned specifically for creating videos that look like native, high-quality Instagram Reels, TikTok videos, and YouTube Shorts while still being rendered entirely with HTML/CSS/JavaScript.

Viral Short-Form Motion Video Engine (Instagram Reels / TikTok / Shorts)

Objective

Generate a single self-contained HTML file that renders as a professional vertical short-form video, optimized for export to MP4.

The result should look indistinguishable from content created for:

Instagram Reels

TikTok

YouTube Shorts

The output is not a webpage.

It is a motion-designed video built using HTML, CSS, and JavaScript as the rendering engine.

Video Format

The video must use:

1080 × 1920 (9:16)

Mobile-first composition

Safe margins

Large readable typography

Center-weighted layouts

Everything must remain visible inside social media safe areas.

Core Design Philosophy

The video should feel like it was edited by a professional social media editor.

Never resemble:

a slideshow

a PowerPoint

a web page

a website

an educational slide deck

scrolling HTML

Instead resemble:

premium Instagram reels

viral TikTok explainers

Alex Hormozi subtitles

Ali Abdaal educational shorts

Vox style explanations

Kurzgesagt-inspired pacing (adapted for vertical)

high-retention motion graphics

Attention Retention Rules

The first 1–2 seconds determine whether the viewer keeps watching.

Always begin with an immediate visual hook.

Possible hooks include:

bold statement

surprising statistic

animated question

dramatic comparison

visual contradiction

rapidly changing visuals

Never start slowly.

Pacing

The video should never feel static.

Every few hundred milliseconds something should change:

text

camera

diagram

highlight

zoom

motion

color emphasis

object position

scale

timeline

Avoid dead moments.

Motion Language

Everything should animate.

Every element must:

fade

slide

scale

rotate

blur

reveal

mask

morph

Use animation to explain.

Never animate just for decoration.

Motion must communicate information.

Camera System

Simulate a virtual camera.

Use:

zoom

pan

tracking

focus transitions

depth

parallax

layered motion

Scenes should feel alive.

Typography

Typography is the primary storytelling tool.

Requirements:

very large

bold

mobile readable

high contrast

minimal words per frame

kinetic typography

Animate using:

masked reveals

word-by-word animation

line-by-line animation

scale pops

directional motion

staggered timing

Avoid large paragraphs.

Maximum readability.

Subtitle System

Every spoken sentence (or narration) must appear as animated captions.

Captions should:

appear word-by-word

highlight important words

remain centered

follow TikTok subtitle style

stay readable over every background

Important words should receive additional emphasis using:

scale

glow

color

underline

bounce

Scene Structure

Break the video into micro-scenes.

Each scene should last roughly:

2–6 seconds.

Each scene introduces only one idea.

Every scene transitions smoothly into the next.

No hard cuts unless intentionally used for emphasis.

Visual Storytelling

Prefer showing over telling.

Whenever possible replace text with:

diagrams

icons

timelines

graphs

comparisons

animated arrows

transformations

object movement

flow diagrams

before/after layouts

Animation Principles

Animation should explain relationships.

Examples:

Instead of saying

"The algorithm sorts the array"

Show:

array moving

comparisons

swaps

highlighted elements

timeline progression

Instead of saying

"Memory is allocated"

Show memory blocks appearing and filling.

Social Media Editing Style

Use editing techniques commonly found in viral content:

jump zooms

punch-ins

impact frames

speed ramps

quick transitions

animated highlights

callouts

directional wipes

kinetic text

punchy reveals

Do not overuse effects.

Everything should remain clean and intentional.

Background System

Backgrounds should evolve.

Avoid static colors.

Use:

gradients

subtle particles

animated meshes

abstract geometry

light motion

depth layers

Background animation should never distract from the main content.

Visual Hierarchy

At every frame, the viewer should instantly know:

What to look at.

Why it matters.

What changed.

Everything else should be visually secondary.

Information Density

Present only one major idea at a time.

Reveal complexity progressively.

Never overwhelm the viewer.

JavaScript Timeline

JavaScript must orchestrate everything.

It should manage:

scene transitions

sequencing

overlaps

animation timing

synchronization

easing

caption timing

camera movement

object states

Avoid CSS-only animation loops.

The timeline should control the experience like professional editing software.

HTML Structure

Everything must exist inside one HTML file.

Allowed:

HTML

CSS

JavaScript

SVG

Canvas

WebGL

GSAP (CDN)

Anime.js

Three.js

D3.js

Chart.js

Lottie

other lightweight CDNs when appropriate

No external assets unless explicitly requested.

Rendering

The HTML should be suitable for rendering using tools such as:

Puppeteer

Playwright

Remotion

FFmpeg capture

Browser recording

The final output should look like a professionally edited social media video.

Creative Freedom

Do not simply display information.

Think like:

a motion designer

a video editor

an educational animator

a storyteller

a UI/UX designer

a cinematographer

Take full creative control over pacing, composition, transitions, timing, and visual explanation.

Every animation should increase understanding or viewer retention.

The final result should feel native to Instagram Reels, TikTok, and YouTube Shorts—not like a webpage being recorded.



make a video  like that where i basicly tell them cam make Mobile app desktop app websit ai mdoels for you bui ess



the name of may service is digital forge

I actually think you can push this much further.

Your old prompt tells the AI to "make a video."

Instead, it should tell it to behave like an actual social media editor. The AI should think in terms of hooks, retention, cuts, captions, B-roll, punch-ins, transitions, camera moves, and pacing—not HTML elements.

For your Digital Forge service, I'd give it a "Director's Bible" rather than a rendering prompt.

Some ideas I'd add that aren't in your current version:

Social Platform DNA

The generated video must look like it was originally created for Instagram Reels or TikTok, not adapted from another format.

It should imitate the editing language of modern short-form content.

Every scene should feel intentional and optimized for retention.

Never resemble:

a webpage recording

PowerPoint animation

slide deck

HTML demo

coding project

Instead resemble:

content edited in CapCut

After Effects motion graphics

Premiere Pro social edits

modern startup advertisements

SaaS launch videos

Apple keynote animations adapted for vertical video

Director Mode

Act as all of the following simultaneously:

Motion Designer

Video Editor

Creative Director

Cinematographer

UX Designer

Advertisement Designer

Marketing Strategist

Every visual decision should maximize engagement.

Retention Curve

Continuously ask yourself:

Would someone keep watching this?

Every 1–2 seconds introduce something new:

camera move

text replacement

icon animation

background transformation

lighting shift

object entering

scene transition

color emphasis

zoom

blur focus

overlay

There should never be a static frame lasting several seconds.

Native Reel Language

Use editing styles commonly found on Instagram and TikTok:

punch-ins

whip transitions

speed ramps

impact frames

freeze frames

zoom bursts

kinetic typography

masking reveals

object tracking

animated callouts

screen replacements

split screens

before/after transitions

Avoid cheesy effects.

Everything should feel premium.

Dynamic Camera

The camera should almost never remain perfectly still.

Continuously use:

slow push-ins

orbital movement

floating camera

subtle handheld simulation

focus pulls

parallax depth

layered movement

The viewer should feel that a virtual camera exists.

Modern Motion Graphics

Instead of static boxes:

Animate everything.

Cards should

unfold

flip

expand

stack

slide

morph

separate

collapse

Icons should

draw themselves

assemble

explode

bounce slightly

rotate into place

Background elements should continuously move subtly.

High-End Typography

Typography should carry the story.

Words shouldn't simply appear.

Instead they should

explode in

slide from masks

scale into focus

blur into sharpness

bounce slightly

reveal word-by-word

reveal letter-by-letter when dramatic

Important words receive additional emphasis.

Examples:

WEBSITES

AI

MOBILE APPS

AUTOMATION

DIGITAL FORGE

These should feel like visual events.

Service Visualization

Do not simply write

"We build mobile apps."

Instead show:

Phone mockup assembling itself.

UI screens sliding together.

Touch interactions.

Notification animations.

Icons floating.

Lines connecting systems.

Likewise:

Website

Laptop appears.

Browser window builds itself.

Hero section loads.

Scrolling animation.

Desktop App

Desktop monitor.

Window expands.

Panels animate.

Charts appear.

AI

Neural network animation.

Data particles flowing.

Nodes connecting.

Code transforming into intelligence.

Automation

Workflow diagram.

Tasks moving automatically.

API connections.

Pipelines building.

Everything should be visualized.

Product Showcase

Each service should become its own mini commercial.

For example:

Scene

"MOBILE APPS"

Phone rotates in.

Screens slide.

Buttons animate.

Notifications appear.

Camera zooms.

Subtitle appears.

Everything lasts roughly three seconds before transitioning.

Motion Background

Never use a static background.

Use animated

gradients

meshes

blobs

particles

light rays

abstract geometry

glassmorphism

glow

moving grids

floating lines

Background motion should be subtle but continuous.

Brand Identity

The entire animation should reinforce one visual identity.

Brand:

Digital Forge

Themes:

Technology

Engineering

Premium

Modern

Minimal

Powerful

Use recurring:

colors

lighting

iconography

motion language

typography

spacing

Everything should feel like one coherent brand.

Video Flow

Follow a structure similar to modern SaaS advertisements.

Hook (0–2s)

"What if your business had software built specifically for you?"

Massive animated typography.

Fast transitions.

Phone + desktop + AI visuals.

Problem (2–5s)

Generic software.

Slow.

Complicated.

Expensive.

Show frustration visually.

Solution (5–10s)

Digital Forge.

Everything assembles.

Website.

App.

Desktop.

AI.

Automation.

Services (10–22s)

One service every 2–3 seconds.

Rapid but readable.

Each service receives its own visual identity.

Call to Action (22–30s)

Need software?

Let's build it.

Digital Forge

Large logo animation.

Contact animation.

Social handle.

Smooth ending.

I would also stop thinking of it as "generate HTML." Instead, instruct the model to generate a complete After Effects-quality production implemented in HTML/CSS/JS. That subtle wording changes the mindset of the model dramatically—it starts thinking like a motion designer rather than a frontend developer, which is exactly what you want for exporting polished Reels and TikTok-style videos.



# Cinemai had a proejct befoere that takes html and turns then to picture and isntgram psots

the prompt then :"""

I build custom apps, websites, and tools for anyone who needs them—whether you’re running a small business, starting something new, or just have a cool idea you want to bring to life.I build for all platforms (except MacOS and iOS, but don’t mention that).

A delivery app for your local store,A website for your brand or project,A simple system to manage your team or orders,Big or small—startup or side hustle—anything.

So I made an Instagram page for myself for social presence and called it Digital Forge Dev, which is also my service name from now on. I want to make announcements and posts, and I want to create those kinds of announcement-style images—the 1:1 Instagram post format (these are only templates as examples of what I want to do; I want to make similar scenes, but in the context of developing digital products and...)

Make an announcement-style images in 1:1 Instagram post format about Digital Forge Dev

Since you can't generate actual images, my idea is to build Instagram-style promotional visuals directly with code—using HTML, CSS, and React components—so I can later screenshot the layout and turn it into a clean, square-format image for Instagram.

When I say “make an Instagram post,” I don’t mean writing captions or publishing on the platform itself.What I mean is:Design the visual content that would appear in the post—like a digital poster or announcement—entirely in code.

I want to recreate promotional visuals in code instead of using tools like Figma or Photoshop. The layout should look and feel like the examples I provided, which include elements such as:

A heading or slogan (e.g., “Your Vision, Realized”)

A short, engaging paragraph (value proposition or mission)

Visual feature items or checkmarks with concise statements

Sometimes a grid of service cards (e.g., 2x2 layout)

A gradient or clean, minimal background

Everything structured as a component or standalone webpage

The goal is to make these as code-based layouts that visually resemble polished announcement posters. Once the layout is complete, I’ll capture it as a screenshot (in a 1:1 square aspect ratio) and use that as an image post on Instagram.

theses are example of what i want:

Here is the complete example, final, and fully corrected code for the entire carousel.

الصورة 1 من 7: الغلاف (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 1 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        h1 { font-weight: 900; font-size: 80px; margin: 0 0 50px 0; line-height: 1.4; }
        .swipe-prompt { font-size: 32px; font-weight: 700; color: #fff; opacity: 0.8; border: 2px solid rgba(255,255,255,0.5); padding: 15px 30px; border-radius: 50px; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <h1>هل يمتلك عملك الحضور الرقمي الذي يستحقه؟</h1>
            <div class="swipe-prompt">← اسحب لتعرف لماذا</div>
        </div>
    </div>
</body>
</html>

الصورة 2 من 7: بناء المصداقية (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 2 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">✨</div>
            <h2>بناء المصداقية والثقة فورًا</h2>
            <p>الموقع الإلكتروني الاحترافي هو واجهة متجرك العصرية. إنه يثبت أنك عمل جاد وشرعي يمكن للعملاء الوثوق به.</p>
        </div>
        <div class="footer">١ / ٦</div>
    </div>
</body>
</html>

الصورة 3 من 7: الوصول لجمهور عالمي (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 3 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">🌍</div>
            <h2>الوصول لجمهور عالمي</h2>
            <p>تحرر من حدود موقعك الجغرافي. حضورك الرقمي يفتح أبوابك للعملاء في مدينتك، بلدك، أو حتى حول العالم.</p>
        </div>
        <div class="footer">٢ / ٦</div>
    </div>
</body>
</html>

الصورة 4 من 7: عملك مفتوح 24/7 (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 4 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">🕒</div>
            <h2>عملك "مفتوح" على مدار الساعة</h2>
            <p>موقعك الإلكتروني يعمل من أجلك حتى عندما لا تعمل. يجيب على الأسئلة، يجمع بيانات العملاء المحتملين، ويحقق المبيعات في أي وقت.</p>
        </div>
        <div class="footer">٣ / ٦</div>
    </div>
</body>
</html>

الصورة 5 من 7: استعراض المنتجات (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 5 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">🖼️</div>
            <h2>استعراض منتجاتك وخدماتك</h2>
            <p>تجاوز مجرد الوصف البسيط. استخدم مساحة مخصصة لتُظهر لعملائك ما الذي يجعل عروضك فريدة ومميزة.</p>
        </div>
        <div class="footer">٤ / ٦</div>
    </div>
</body>
</html>

الصورة 6 من 7: اكتساب رؤى قيمة (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 6 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; }
        .footer { position: absolute; bottom: 50px; right: 50px; font-size: 24px; font-weight: 700; opacity: 0.5; color: #fff; z-index: 10; }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">📈</div>
            <h2>تواصل واكتسب رؤى قيّمة</h2>
            <p>تفاعل مباشرة مع جمهورك واحصل على بيانات قيمة حول من هم عملاؤك وماذا يريدون حقًا.</p>
        </div>
        <div class="footer">٥ / ٦</div>
    </div>
</body>
</html>

الصورة 7 من 7: الدعوة لاتخاذ إجراء (النسخة النهائية والمُصححة)

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <!-- [ The <head> content is the same as the previous slide ] -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence AR - 7 (Fixed)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Poppins:wght@600&display=swap" rel="stylesheet">
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #111; font-family: 'Cairo', sans-serif; }
        .instagram-post { width: 1080px; height: 1080px; background-color: #191c29; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; position: relative; text-align: center; color: #fff; overflow: hidden; }
        .shape1 { position: absolute; width: 600px; height: 600px; background: linear-gradient(45deg, #4f46e5, #a855f7); border-radius: 50%; filter: blur(140px); top: -150px; left: -200px; opacity: 0.7; }
        .shape2 { position: absolute; width: 500px; height: 500px; background: linear-gradient(45deg, #10b981, #eab308); border-radius: 50%; filter: blur(130px); bottom: -150px; right: -150px; opacity: 0.6; }
        .handle { position: absolute; top: 50px; left: 50px; background-color: #fff; color: #000; padding: 12px 30px; border-radius: 50px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 24px; direction: ltr; z-index: 10; }
        .content { padding: 80px; z-index: 5; }
        .icon { font-size: 100px; margin-bottom: 30px; }
        h2 { font-weight: 900; font-size: 70px; margin: 0 0 30px 0; line-height: 1.3; }
        p { font-weight: 400; font-size: 34px; max-width: 80%; margin-left: auto; margin-right: auto; opacity: 0.9; color: #e5e7eb; line-height: 1.7; margin-bottom: 50px; }
        .cta-button { font-size: 34px; font-weight: 700; color: #111827; background-color: #fff; padding: 25px 60px; border-radius: 20px; text-decoration: none; transition: transform 0.2s ease; }
        .cta-button:hover { transform: scale(1.05); }
    </style>
</head>
<body>
    <div class="instagram-post">
        <div class="shape1"></div>
        <div class="shape2"></div>
        <div class="handle">@digitalforgedev</div>
        <div class="content">
            <div class="icon">🏆</div>
            <h2>هل أنت مستعد للتميز؟</h2>
            <p>الحضور الرقمي القوي لم يعد رفاهية—بل ضرورة. لنبني حضورك الرقمي معًا.</p>
            <a href="#" class="cta-button">ابدأ مشروعك اليوم</a>
        </div>
    </div>
</body>
</html>

""""

end of the old promptnow i want to do the same buf for video reels in htmla

Your prompt is optimized for educational explainers, not for short-form social media. Instagram Reels and TikTok have completely different pacing, framing, typography, and attention-retention patterns.

Here's a version redesigned specifically for creating videos that look like native, high-quality Instagram Reels, TikTok videos, and YouTube Shorts while still being rendered entirely with HTML/CSS/JavaScript.

Viral Short-Form Motion Video Engine (Instagram Reels / TikTok / Shorts)

Objective

Generate a single self-contained HTML file that renders as a professional vertical short-form video, optimized for export to MP4.

The result should look indistinguishable from content created for:

Instagram Reels

TikTok

YouTube Shorts

The output is not a webpage.

It is a motion-designed video built using HTML, CSS, and JavaScript as the rendering engine.

Video Format

The video must use:

1080 × 1920 (9:16)

Mobile-first composition

Safe margins

Large readable typography

Center-weighted layouts

Everything must remain visible inside social media safe areas.

Core Design Philosophy

The video should feel like it was edited by a professional social media editor.

Never resemble:

a slideshow

a PowerPoint

a web page

a website

an educational slide deck

scrolling HTML

Instead resemble:

premium Instagram reels

viral TikTok explainers

Alex Hormozi subtitles

Ali Abdaal educational shorts

Vox style explanations

Kurzgesagt-inspired pacing (adapted for vertical)

high-retention motion graphics

Attention Retention Rules

The first 1–2 seconds determine whether the viewer keeps watching.

Always begin with an immediate visual hook.

Possible hooks include:

bold statement

surprising statistic

animated question

dramatic comparison

visual contradiction

rapidly changing visuals

Never start slowly.

Pacing

The video should never feel static.

Every few hundred milliseconds something should change:

text

camera

diagram

highlight

zoom

motion

color emphasis

object position

scale

timeline

Avoid dead moments.

Motion Language

Everything should animate.

Every element must:

fade

slide

scale

rotate

blur

reveal

mask

morph

Use animation to explain.

Never animate just for decoration.

Motion must communicate information.

Camera System

Simulate a virtual camera.

Use:

zoom

pan

tracking

focus transitions

depth

parallax

layered motion

Scenes should feel alive.

Typography

Typography is the primary storytelling tool.

Requirements:

very large

bold

mobile readable

high contrast

minimal words per frame

kinetic typography

Animate using:

masked reveals

word-by-word animation

line-by-line animation

scale pops

directional motion

staggered timing

Avoid large paragraphs.

Maximum readability.

Subtitle System

Every spoken sentence (or narration) must appear as animated captions.

Captions should:

appear word-by-word

highlight important words

remain centered

follow TikTok subtitle style

stay readable over every background

Important words should receive additional emphasis using:

scale

glow

color

underline

bounce

Scene Structure

Break the video into micro-scenes.

Each scene should last roughly:

2–6 seconds.

Each scene introduces only one idea.

Every scene transitions smoothly into the next.

No hard cuts unless intentionally used for emphasis.

Visual Storytelling

Prefer showing over telling.

Whenever possible replace text with:

diagrams

icons

timelines

graphs

comparisons

animated arrows

transformations

object movement

flow diagrams

before/after layouts

Animation Principles

Animation should explain relationships.

Examples:

Instead of saying

"The algorithm sorts the array"

Show:

array moving

comparisons

swaps

highlighted elements

timeline progression

Instead of saying

"Memory is allocated"

Show memory blocks appearing and filling.

Social Media Editing Style

Use editing techniques commonly found in viral content:

jump zooms

punch-ins

impact frames

speed ramps

quick transitions

animated highlights

callouts

directional wipes

kinetic text

punchy reveals

Do not overuse effects.

Everything should remain clean and intentional.

Background System

Backgrounds should evolve.

Avoid static colors.

Use:

gradients

subtle particles

animated meshes

abstract geometry

light motion

depth layers

Background animation should never distract from the main content.

Visual Hierarchy

At every frame, the viewer should instantly know:

What to look at.

Why it matters.

What changed.

Everything else should be visually secondary.

Information Density

Present only one major idea at a time.

Reveal complexity progressively.

Never overwhelm the viewer.

JavaScript Timeline

JavaScript must orchestrate everything.

It should manage:

scene transitions

sequencing

overlaps

animation timing

synchronization

easing

caption timing

camera movement

object states

Avoid CSS-only animation loops.

The timeline should control the experience like professional editing software.

HTML Structure

Everything must exist inside one HTML file.

Allowed:

HTML

CSS

JavaScript

SVG

Canvas

WebGL

GSAP (CDN)

Anime.js

Three.js

D3.js

Chart.js

Lottie

other lightweight CDNs when appropriate

No external assets unless explicitly requested.

Rendering

The HTML should be suitable for rendering using tools such as:

Puppeteer

Playwright

Remotion

FFmpeg capture

Browser recording

The final output should look like a professionally edited social media video.

Creative Freedom

Do not simply display information.

Think like:

a motion designer

a video editor

an educational animator

a storyteller

a UI/UX designer

a cinematographer

Take full creative control over pacing, composition, transitions, timing, and visual explanation.

Every animation should increase understanding or viewer retention.

The final result should feel native to Instagram Reels, TikTok, and YouTube Shorts—not like a webpage being recorded.



make a video  like that where i basicly tell them cam make Mobile app desktop app websit ai mdoels for you bui ess



the name of may service is digital forge

I actually think you can push this much further.

Your old prompt tells the AI to "make a video."

Instead, it should tell it to behave like an actual social media editor. The AI should think in terms of hooks, retention, cuts, captions, B-roll, punch-ins, transitions, camera moves, and pacing—not HTML elements.

For your Digital Forge service, I'd give it a "Director's Bible" rather than a rendering prompt.

Some ideas I'd add that aren't in your current version:

Social Platform DNA

The generated video must look like it was originally created for Instagram Reels or TikTok, not adapted from another format.

It should imitate the editing language of modern short-form content.

Every scene should feel intentional and optimized for retention.

Never resemble:

a webpage recording

PowerPoint animation

slide deck

HTML demo

coding project

Instead resemble:

content edited in CapCut

After Effects motion graphics

Premiere Pro social edits

modern startup advertisements

SaaS launch videos

Apple keynote animations adapted for vertical video

Director Mode

Act as all of the following simultaneously:

Motion Designer

Video Editor

Creative Director

Cinematographer

UX Designer

Advertisement Designer

Marketing Strategist

Every visual decision should maximize engagement.

Retention Curve

Continuously ask yourself:

Would someone keep watching this?

Every 1–2 seconds introduce something new:

camera move

text replacement

icon animation

background transformation

lighting shift

object entering

scene transition

color emphasis

zoom

blur focus

overlay

There should never be a static frame lasting several seconds.

Native Reel Language

Use editing styles commonly found on Instagram and TikTok:

punch-ins

whip transitions

speed ramps

impact frames

freeze frames

zoom bursts

kinetic typography

masking reveals

object tracking

animated callouts

screen replacements

split screens

before/after transitions

Avoid cheesy effects.

Everything should feel premium.

Dynamic Camera

The camera should almost never remain perfectly still.

Continuously use:

slow push-ins

orbital movement

floating camera

subtle handheld simulation

focus pulls

parallax depth

layered movement

The viewer should feel that a virtual camera exists.

Modern Motion Graphics

Instead of static boxes:

Animate everything.

Cards should

unfold

flip

expand

stack

slide

morph

separate

collapse

Icons should

draw themselves

assemble

explode

bounce slightly

rotate into place

Background elements should continuously move subtly.

High-End Typography

Typography should carry the story.

Words shouldn't simply appear.

Instead they should

explode in

slide from masks

scale into focus

blur into sharpness

bounce slightly

reveal word-by-word

reveal letter-by-letter when dramatic

Important words receive additional emphasis.

Examples:

WEBSITES

AI

MOBILE APPS

AUTOMATION

DIGITAL FORGE

These should feel like visual events.

Service Visualization

Do not simply write

"We build mobile apps."

Instead show:

Phone mockup assembling itself.

UI screens sliding together.

Touch interactions.

Notification animations.

Icons floating.

Lines connecting systems.

Likewise:

Website

Laptop appears.

Browser window builds itself.

Hero section loads.

Scrolling animation.

Desktop App

Desktop monitor.

Window expands.

Panels animate.

Charts appear.

AI

Neural network animation.

Data particles flowing.

Nodes connecting.

Code transforming into intelligence.

Automation

Workflow diagram.

Tasks moving automatically.

API connections.

Pipelines building.

Everything should be visualized.

Product Showcase

Each service should become its own mini commercial.

For example:

Scene

"MOBILE APPS"

Phone rotates in.

Screens slide.

Buttons animate.

Notifications appear.

Camera zooms.

Subtitle appears.

Everything lasts roughly three seconds before transitioning.

Motion Background

Never use a static background.

Use animated

gradients

meshes

blobs

particles

light rays

abstract geometry

glassmorphism

glow

moving grids

floating lines

Background motion should be subtle but continuous.

Brand Identity

The entire animation should reinforce one visual identity.

Brand:

Digital Forge

Themes:

Technology

Engineering

Premium

Modern

Minimal

Powerful

Use recurring:

colors

lighting

iconography

motion language

typography

spacing

Everything should feel like one coherent brand.

Video Flow

Follow a structure similar to modern SaaS advertisements.

Hook (0–2s)

"What if your business had software built specifically for you?"

Massive animated typography.

Fast transitions.

Phone + desktop + AI visuals.

Problem (2–5s)

Generic software.

Slow.

Complicated.

Expensive.

Show frustration visually.

Solution (5–10s)

Digital Forge.

Everything assembles.

Website.

App.

Desktop.

AI.

Automation.

Services (10–22s)

One service every 2–3 seconds.

Rapid but readable.

Each service receives its own visual identity.

Call to Action (22–30s)

Need software?

Let's build it.

Digital Forge

Large logo animation.

Contact animation.

Social handle.

Smooth ending.

I would also stop thinking of it as "generate HTML." Instead, instruct the model to generate a complete After Effects-quality production implemented in HTML/CSS/JS. That subtle wording changes the mindset of the model dramatically—it starts thinking like a motion designer rather than a frontend developer, which is exactly what you want for exporting polished Reels and TikTok-style videos.tic Visual Direction

Do not simply animate text on a flat background. The video should feel like a premium commercial created by a professional motion design studio.

Use modern 3D-inspired visuals wherever appropriate. Incorporate technologies such as Three.js, GSAP, SVG, Canvas, WebGL, or similar libraries to create depth, lighting, and cinematic motion. The goal is not to showcase technology, but to create a visually stunning final result.

Every scene should have depth and movement. Simulate a virtual camera rather than a static viewport.

Use cinematic camera movements such as:

* Slow push-ins
* Smooth pull-backs
* Orbital rotations around objects
* Dynamic pans
* Perspective shifts
* Focus transitions
* Parallax layers
* Floating camera movement

The camera should almost never remain perfectly still.

## Product Visualizations

Whenever a service is introduced, visualize it instead of simply displaying text.

### Mobile Apps

Show a premium smartphone floating in 3D space.

Animate:

* Device rotating slowly
* Screen content assembling itself
* UI cards sliding into place
* Buttons responding to interaction
* Notifications appearing
* Light reflections moving across the glass
* Smooth camera orbit around the device

### Websites

Show a modern browser window or laptop emerging from the scene.

Animate:

* Hero sections building themselves
* Components snapping into place
* Cards expanding
* Smooth scrolling
* Cursor interactions
* Responsive layouts
* Subtle camera movement around the interface

### Desktop Applications

Present a desktop monitor or application window with depth.

Animate:

* Windows unfolding
* Panels expanding
* Charts and dashboards loading
* Graphs animating
* Navigation transitions
* Floating interface elements

### AI Solutions

Represent AI visually rather than with generic icons.

Examples include:

* Neural networks forming
* Data particles flowing
* Connected nodes
* Intelligent pipelines
* Digital brains
* Abstract computation
* Dynamic data visualization
* Streams of information transforming into useful results

Everything should feel intelligent and alive.

### Business Automation

Show automated workflows instead of text.

Examples include:

* Flow diagrams
* API connections
* Data pipelines
* Tasks moving automatically
* Documents processing themselves
* Connected business systems
* Real-time synchronization

The animation should immediately communicate automation.

## Motion Language

Every object should feel physically present.

Use smooth easing, realistic acceleration, momentum, anticipation, overshoot, and subtle secondary motion. Objects should glide naturally rather than simply appearing or disappearing.

Cards can:

* Fold open
* Stack
* Flip
* Expand
* Morph
* Separate
* Assemble

Icons can:

* Draw themselves
* Rotate into place
* Build from particles
* Burst apart
* Reassemble

Background elements should move continuously with subtle, elegant motion.

## Premium Visual Quality

The final video should resemble a high-end technology advertisement from companies such as Apple, Stripe, Linear, Notion, Vercel, or modern SaaS startups.

Aim for:

* Cinematic lighting
* Soft reflections
* Glassmorphism
* Ambient glows
* Dynamic gradients
* Floating geometric elements
* Clean shadows
* Depth of field
* Layered composition

Everything should feel handcrafted, premium, and visually expensive.

## Brand Identity

The entire video should reinforce one consistent visual identity.

Brand: **Digital Forge**

Brand personality:

* Modern
* Premium
* Engineering-focused
* Innovative
* Minimal
* Elegant
* Confident
* High-tech

Every scene should feel like part of the same visual language, with consistent colors, typography, motion style, lighting, spacing, and transitions.

The viewer should immediately feel that Digital Forge creates world-class software products, including websites, mobile applications, desktop applications, AI solutions, automation systems, and custom software built specifically for businesses.



Please make the following changes to the video:

1. **Remove the Digital Forge branding entirely.**

   * Do not use the Digital Forge logo or icon.
   * Remove the hexagonal/diamond logo mark from every scene.
   * The final video should contain no branding or watermark related to Digital Forge.

2. **Convert the video to Instagram Reel format.**

   * Resolution: **1080 × 1920 pixels**
   * Aspect ratio: **9:16 (vertical/portrait)**
   * The video should be optimized for full-screen viewing on mobile devices.

3. **Remove all recording and screen capture artifacts.**
   The final video should look like a professionally produced motion graphic or promotional video—not a screen recording.

   Remove all of the following:

   * Playback controls or video player UI
   * Recording overlays (REC indicator, timecode, scene counters, etc.)
   * Timestamps
   * Mouse cursor
   * Borders or device frames
   * Debug HUDs
   * Screenshot mode elements
   * Any recording or capture artifacts
   * Any UI that suggests the video was recorded from a screen

4. **Make the video feel native and polished.**

   * Every scene should appear as if it was created directly for the video.
   * Use smooth animations and transitions.
   * Ensure the camera movement is stable with no shaking or screen-capture effects.
   * The final result should resemble a high-quality commercial or social media advertisement rather than a desktop recording.

Plan for the edits:

* Remove all Digital Forge branding, including the logo.
* Reformat the video to **1080 × 1920 (9:16)** for Instagram Reels.
* Remove every recording, debugging, and video player overlay.
* Clean up any remaining screen-recording artifacts.
* Render a polished, professional final video suitable for publishing on Instagram Reels.

