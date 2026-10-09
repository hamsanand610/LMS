import type { CurriculumCourse } from './types.js';

export const COURSE: CurriculumCourse = {
  slug: 'aptitude-and-soft-skills',
  title: 'Aptitude, Reasoning and Placement Readiness',
  subject: 'aptitude',
  level: 'beginner',
  description:
    'Preparation for campus placement rounds: quantitative aptitude with worked methods and shortcuts, logical reasoning, verbal ability, professional communication and email, a strong one-page resume, group discussions, and technical and HR interviews answered with the STAR method.',
  tags: [
    'aptitude',
    'reasoning',
    'verbal-ability',
    'communication',
    'resume',
    'interviews',
    'placement',
  ],
  modules: [
    {
      title: 'Numbers',
      summary:
        'Quantitative aptitude for written tests: percentages, ratios and averages, profit and loss, time and work, time-speed-distance and number properties, with worked examples and shortcuts.',
      lessons: [
        {
          kind: 'article',
          title: 'Percentages and the multiplier method',
          minutes: 20,
          topic: 'Percentages',
          html: `<p>Percentages appear in nearly every aptitude test, and they also sit underneath profit and loss, interest, discounts and data interpretation. Master one idea here — turning every percentage change into a multiplier — and a large share of the quantitative section becomes quick and reliable.</p>
<h2>Percent means "per hundred"</h2>
<p>25% means 25 out of 100: the same as 0.25 or 1/4. Knowing the common fractions by heart saves a lot of time.</p>
<table>
<thead><tr><th>Fraction</th><th>Percentage</th><th>Fraction</th><th>Percentage</th></tr></thead>
<tbody>
<tr><td>1/2</td><td>50%</td><td>1/8</td><td>12.5%</td></tr>
<tr><td>1/3</td><td>33⅓%</td><td>1/9</td><td>11.11%</td></tr>
<tr><td>1/4</td><td>25%</td><td>1/10</td><td>10%</td></tr>
<tr><td>1/5</td><td>20%</td><td>1/12</td><td>8⅓%</td></tr>
<tr><td>1/6</td><td>16⅔%</td><td>1/20</td><td>5%</td></tr>
</tbody>
</table>
<p>With this table, 16⅔% of 4,200 is simply 4,200 ÷ 6 = 700, and 12.5% of 640 is 640 ÷ 8 = 80. No long multiplication needed.</p>
<h2>The multiplier method</h2>
<ul>
<li>An increase of r% multiplies the value by (1 + r/100). Up 20% means × 1.2.</li>
<li>A decrease of r% multiplies it by (1 − r/100). Down 15% means × 0.85.</li>
</ul>
<p><strong>Worked example.</strong> A laptop costs ₹48,000. Its price rises by 10% and then falls by 10%. What is the final price?</p>
<p>48,000 × 1.1 × 0.9 = 48,000 × 0.99 = ₹47,520. It does <em>not</em> return to ₹48,000, because the 10% fall is taken on the bigger, increased price. A rise and a fall of the same r% always leave a net loss of r²/100 percent — here, 1%.</p>
<h3>Successive changes</h3>
<p>Two successive changes of a% and b% combine into a single change of a + b + ab/100 percent. Use negative numbers for decreases.</p>
<p><strong>Worked example.</strong> A shop gives 20% off, then a further 10% off the reduced price. What single discount is this?</p>
<p>(−20) + (−10) + (−20)(−10)/100 = −30 + 2 = −28. So it is a 28% discount, not 30%. Check with multipliers: 0.8 × 0.9 = 0.72, which is 28% off.</p>
<p>Because multiplication does not depend on order, a 10% discount followed by 18% tax gives exactly the same final amount as the tax followed by the discount. Questions sometimes try to make you think the order matters.</p>
<h2>Working backwards to the original</h2>
<p><strong>Worked example.</strong> After a 25% increase, a monthly hostel fee is ₹7,500. What was it before?</p>
<p>Original × 1.25 = 7,500, so the original = 7,500 ÷ 1.25 = ₹6,000. The classic trap is to take 25% of ₹7,500 (₹1,875) and subtract it, giving ₹5,625 — wrong, because the 25% was calculated on the original fee, not on ₹7,500.</p>
<h3>"More than" and "less than"</h3>
<p>Percentage change = (new − old) ÷ old × 100. If Rohit scored 40 marks and Sana scored 50, Sana scored 10 ÷ 40 = 25% more than Rohit, but Rohit scored 10 ÷ 50 = 20% less than Sana. The base is always the quantity that comes after "than".</p>
<h2>Common mistakes</h2>
<ul>
<li>Adding successive percentages: 20% off and then 10% off is not 30% off.</li>
<li>Using the wrong base for "more than" and "less than".</li>
<li>Undoing an increase by subtracting the same percentage from the new value.</li>
</ul>
<h3>Check yourself</h3>
<ol>
<li>A town of 50,000 people grows by 10% in one year and by 10% again the next. What is its population after two years?</li>
<li>A price falls by 20%. By what percentage must it now rise to get back to the original?</li>
</ol>
<details><summary>Answers</summary><p>1. 50,000 × 1.1 × 1.1 = 50,000 × 1.21 = 60,500.</p><p>2. Take the price as 100. It falls to 80, and getting back to 100 needs a rise of 20 on a base of 80: 20 ÷ 80 = 25%.</p></details>`,
        },
        { kind: 'practice', question: 'aptitude-percentage', topic: 'Percentages' },
        {
          kind: 'article',
          title: 'Ratios, proportion and averages',
          minutes: 20,
          topic: 'Ratios and averages',
          html: `<p>Ratios compare quantities; averages summarise them. Both appear constantly in placement tests, often in the same question, and both reward the habit of thinking in "parts" and "totals" instead of reaching straight for algebra.</p>
<h2>Ratios as parts</h2>
<p>A ratio of 3 : 5 means "for every 3 of the first, there are 5 of the second". Think of it as 3 parts and 5 parts — 8 parts in total.</p>
<p><strong>Worked example.</strong> Prize money of ₹12,000 is shared between two teams in the ratio 3 : 5. How much does each team get?</p>
<p>There are 8 parts, so one part = 12,000 ÷ 8 = ₹1,500. The teams get 3 × 1,500 = ₹4,500 and 5 × 1,500 = ₹7,500. Check: 4,500 + 7,500 = 12,000.</p>
<h3>Combining ratios</h3>
<p>If A : B = 2 : 3 and B : C = 4 : 5, what is A : B : C? Make the shared term B the same in both ratios. B is 3 in the first and 4 in the second, so scale both to 12: A : B = 8 : 12 and B : C = 12 : 15. So A : B : C = 8 : 12 : 15.</p>
<h3>Changing a ratio</h3>
<p><strong>Worked example.</strong> A class of 60 has boys and girls in the ratio 7 : 5. How many more girls must join to make the ratio 1 : 1?</p>
<p>One part = 60 ÷ 12 = 5, so there are 35 boys and 25 girls. For equal numbers, 10 more girls must join. The number of boys never changes — anchoring on the quantity that stays fixed is the key to most "changing ratio" questions.</p>
<h2>Direct and inverse proportion</h2>
<p><strong>Direct:</strong> if 4 notebooks cost ₹180, then 7 cost 180 ÷ 4 × 7 = ₹315. <strong>Inverse:</strong> if 6 printers finish a job in 10 hours, 4 printers need 6 × 10 ÷ 4 = 15 hours, because the total work — 60 printer-hours — stays the same. Ask yourself: when one quantity goes up, does the other go up or down?</p>
<h2>Averages: work with the sum</h2>
<p>Average = sum ÷ count, so sum = average × count. Most average questions become easy once you switch to sums.</p>
<p><strong>Worked example.</strong> The average mark of 30 students is 62. On re-checking, one paper gains 15 marks and another gains 6. What is the new average?</p>
<p>The sum rises by 21, so the average rises by 21 ÷ 30 = 0.7. The new average is 62.7.</p>
<p><strong>Worked example.</strong> The average age of 5 friends is 21. A sixth friend joins and the average becomes 22. How old is the new friend?</p>
<p>Old sum = 5 × 21 = 105. New sum = 6 × 22 = 132. The new friend is 132 − 105 = 27. Shortcut: the newcomer brings the new average (22) plus one extra year for each of the five others (5), so 22 + 5 = 27.</p>
<h3>The deviation shortcut</h3>
<p>To average 47, 52, 49, 55 and 47, choose a convenient base such as 50. The differences from it are −3, +2, −1, +5 and −3, which add up to 0, so the average is exactly 50. With larger numbers, this saves long additions.</p>
<h2>Common mistakes</h2>
<ul>
<li>Combining two ratios without first making their common term equal.</li>
<li>Averaging the averages of groups of different sizes. If 10 students average 60 and 30 students average 80, the overall average is (600 + 2,400) ÷ 40 = 75, not 70.</li>
<li>Mixing units: hours with minutes, rupees with paise.</li>
</ul>
<h3>Check yourself</h3>
<ol>
<li>Divide ₹9,000 among A, B and C in the ratio 2 : 3 : 4.</li>
<li>The average of 8 numbers is 15. If the number 29 is removed, what is the average of the rest?</li>
</ol>
<details><summary>Answers</summary><p>1. There are 9 parts, so one part is ₹1,000: A gets ₹2,000, B ₹3,000 and C ₹4,000.</p><p>2. The sum is 8 × 15 = 120. Without 29 it is 91, and 91 ÷ 7 = 13.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Profit, loss and discounts',
          minutes: 20,
          topic: 'Profit and loss',
          html: `<p>Profit and loss questions are percentage questions dressed in business vocabulary. Once you know which amount is the base for each percentage, they become routine.</p>
<h2>The vocabulary</h2>
<ul>
<li><strong>Cost price (CP):</strong> what the seller paid.</li>
<li><strong>Selling price (SP):</strong> what the buyer pays.</li>
<li><strong>Marked price (MP)</strong>, or list price: the price on the tag, before any discount.</li>
<li>Profit = SP − CP; loss = CP − SP.</li>
<li><strong>Profit % and loss % are calculated on the CP</strong>, unless the question says otherwise.</li>
<li><strong>Discount % is calculated on the MP.</strong></li>
</ul>
<h2>Worked examples</h2>
<p><strong>1. Profit percentage.</strong> A shopkeeper buys a calculator for ₹640 and sells it for ₹800. The profit is ₹160, and the profit % is 160 ÷ 640 × 100 = 25%.</p>
<p><strong>2. Selling price from a loss.</strong> A bag that cost ₹1,200 is sold at a 15% loss. SP = 1,200 × 0.85 = ₹1,020.</p>
<p><strong>3. Cost price from the selling price.</strong> A phone case sold for ₹460 earns a 15% profit. CP × 1.15 = 460, so CP = 460 ÷ 1.15 = ₹400. Taking 15% of ₹460 and subtracting it is the classic trap.</p>
<p><strong>4. Marking up, then discounting.</strong> A trader marks goods 40% above cost and then gives a 20% discount. What is the profit %?</p>
<p>Let CP = 100. Then MP = 140 and SP = 140 × 0.8 = 112, so the profit is 12%. Choosing 100 as the cost price turns many questions into simple arithmetic.</p>
<p><strong>5. How much to mark up.</strong> A seller wants a 20% profit after giving a 25% discount. How far above cost should the item be marked?</p>
<p>Let CP = 100. The SP must be 120. After a 25% discount, the SP is 75% of the MP, so MP = 120 ÷ 0.75 = 160. Mark it 60% above cost.</p>
<h2>A famous trap: same price, same percentage</h2>
<p>A dealer sells two scooters for ₹36,000 each, gaining 20% on one and losing 20% on the other. Overall, is it a profit, a loss or neither?</p>
<p>The first scooter cost 36,000 ÷ 1.2 = ₹30,000. The second cost 36,000 ÷ 0.8 = ₹45,000. The total CP is ₹75,000 and the total SP is ₹72,000, so there is a loss of ₹3,000, which is 4% of 75,000.</p>
<p>Shortcut: when two items sell at the same price, one at x% gain and the other at x% loss, there is always an overall loss of x²/100 percent — here 400 ÷ 100 = 4%.</p>
<h3>False weights</h3>
<p>A grocer claims to sell at cost price but uses a 900 g weight in place of 1 kg. Each time, he hands over 900 g but charges for 1,000 g, so he gains the price of 100 g on goods that cost him the price of 900 g. Gain % = 100 ÷ 900 × 100 = 11.11% (11 1/9%). The base is what he actually gives, because that is what it cost him.</p>
<h2>Common mistakes</h2>
<ul>
<li>Calculating profit % on the SP instead of the CP.</li>
<li>Calculating discount % on the CP instead of the MP.</li>
<li>Assuming that a 20% gain on one item and a 20% loss on another breaks even.</li>
</ul>
<h3>Check yourself</h3>
<ol>
<li>An article is sold for ₹1,680 at a 12% profit. What was its cost price?</li>
<li>Successive discounts of 10% and 5% are given on a marked price of ₹2,000. What is the selling price?</li>
</ol>
<details><summary>Answers</summary><p>1. CP = 1,680 ÷ 1.12 = ₹1,500.</p><p>2. 2,000 × 0.9 × 0.95 = 2,000 × 0.855 = ₹1,710.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Time and work',
          minutes: 20,
          topic: 'Time and work',
          html: `<p>Time and work questions ask how long a job takes when people, pipes or machines work at different speeds. The reliable method is to stop thinking in days and start thinking in <strong>work per day</strong>.</p>
<h2>Rates add up; times do not</h2>
<p>If Asha can paint a wall in 4 hours, she paints 1/4 of it each hour. If Vikram takes 12 hours, he paints 1/12 each hour. Together they paint 1/4 + 1/12 = 3/12 + 1/12 = 4/12 = 1/3 of the wall per hour, so together they need 3 hours.</p>
<p>A quick sanity check for any answer: working together, they must be faster than the faster person alone. Here, 3 hours is less than Asha's 4.</p>
<h2>The LCM method: no fractions</h2>
<p>Take the total work to be the LCM of the given times, then convert each person's time into units of work per day.</p>
<p><strong>Worked example.</strong> A can finish a project in 10 days, B in 15 days and C in 30 days. How long do all three take together?</p>
<p>The LCM of 10, 15 and 30 is 30, so call the project 30 units. A does 3 units a day, B does 2 and C does 1. Together they do 6 units a day, so they need 30 ÷ 6 = 5 days.</p>
<h3>When someone leaves part-way</h3>
<p><strong>Worked example.</strong> A and B together can do a job in 12 days, and A alone takes 20 days. They start together, but B leaves after 4 days. How many more days does A need to finish?</p>
<p>Let the job be LCM(12, 20) = 60 units. Together they do 60 ÷ 12 = 5 units a day; A alone does 60 ÷ 20 = 3, so B must do 2. In 4 days together they complete 20 units, leaving 40. A alone needs 40 ÷ 3 = 13⅓ more days.</p>
<h2>Pipes and cisterns</h2>
<p>The same idea with one twist: an outlet pipe or a leak <em>removes</em> work, so its rate counts as negative.</p>
<p><strong>Worked example.</strong> Pipe P fills a tank in 6 hours and pipe Q fills it in 8 hours, while a leak empties it in 12 hours. With all three open, how long does the tank take to fill?</p>
<p>Let the tank be LCM(6, 8, 12) = 24 units. P adds 4 units an hour, Q adds 3, and the leak removes 2. The net rate is 5 units an hour, so the tank fills in 24 ÷ 5 = 4.8 hours — 4 hours and 48 minutes.</p>
<h2>Workers and days</h2>
<p>When a question says "12 workers finish a job in 15 days", the job is 12 × 15 = 180 worker-days. To finish it in 10 days you need 180 ÷ 10 = 18 workers. If the hours per day change as well, include them: total work = workers × days × hours per day.</p>
<h2>Common mistakes</h2>
<ul>
<li>Adding or averaging the times instead of the rates.</li>
<li>Forgetting that a leak or an outlet pipe has a negative rate.</li>
<li>Answering the wrong question: in the example where B leaves, "how many more days" is 13⅓, but "how many days in all" would be 4 + 13⅓ = 17⅓.</li>
</ul>
<h3>Check yourself</h3>
<ol>
<li>X can do a job in 8 days and Y in 24 days. How long do they take working together?</li>
<li>15 people build a stage in 8 days. How many people are needed to build it in 6 days?</li>
</ol>
<details><summary>Answers</summary><p>1. Let the job be 24 units. X does 3 a day and Y does 1, so together they do 4 a day and need 6 days.</p><p>2. The stage needs 15 × 8 = 120 person-days, and 120 ÷ 6 = 20 people.</p></details>`,
        },
        { kind: 'practice', question: 'aptitude-time-work', topic: 'Time and work' },
        {
          kind: 'article',
          title: 'Time, speed and distance',
          minutes: 20,
          topic: 'Speed and distance',
          html: `<p>Distance = speed × time. Every question in this topic is that one formula, applied carefully with the right units and the right idea of "relative" speed.</p>
<h2>Units first</h2>
<p>To convert km/h into m/s, multiply by 5/18; to convert m/s into km/h, multiply by 18/5. The reason: 1 km/h is 1,000 m in 3,600 s, which is 1,000/3,600 = 5/18 m/s. So 72 km/h = 72 × 5/18 = 20 m/s, and 15 m/s = 15 × 18/5 = 54 km/h.</p>
<h2>Average speed is not the average of the speeds</h2>
<p><strong>Worked example.</strong> You ride to college at 30 km/h and come back along the same road at 20 km/h. What is your average speed for the round trip?</p>
<p>Average speed = total distance ÷ total time. Take the distance as 60 km each way (the LCM of 30 and 20 keeps the numbers whole). Going takes 2 hours and returning takes 3, so you cover 120 km in 5 hours: 24 km/h, not 25.</p>
<p>For equal distances at speeds a and b, the shortcut is 2ab ÷ (a + b) = 2 × 30 × 20 ÷ 50 = 24. The average leans towards the slower speed, because you spend more time going slowly.</p>
<h2>Relative speed</h2>
<ul>
<li>Moving in <strong>opposite</strong> directions (towards or away from each other): add the speeds.</li>
<li>Moving in the <strong>same</strong> direction: subtract them.</li>
</ul>
<p><strong>Worked example.</strong> Two cities are 300 km apart. At the same moment, a bus leaves one city at 50 km/h and a car leaves the other at 70 km/h, heading towards each other. When do they meet? They close the gap at 50 + 70 = 120 km/h, so they meet after 300 ÷ 120 = 2.5 hours.</p>
<h3>Trains</h3>
<p>A train "crossing" something must travel its own length plus the length of whatever it crosses. A pole or a person counts as having no length.</p>
<p><strong>Worked example.</strong> A 240 m train runs at 54 km/h. How long does it take to cross a 360 m platform?</p>
<p>Speed = 54 × 5/18 = 15 m/s. Distance = 240 + 360 = 600 m. Time = 600 ÷ 15 = 40 seconds.</p>
<p><strong>Worked example.</strong> Two trains, 150 m and 100 m long, run on parallel tracks in the same direction at 70 km/h and 52 km/h. How long does the faster train take to pass the slower one completely?</p>
<p>The relative speed is 70 − 52 = 18 km/h, which is 5 m/s. The distance to cover is 150 + 100 = 250 m, so the time is 250 ÷ 5 = 50 seconds.</p>
<h2>Common mistakes</h2>
<ul>
<li>Mixing km/h with metres and seconds. Convert everything before you calculate.</li>
<li>Taking the simple average of two speeds.</li>
<li>Forgetting the train's own length.</li>
</ul>
<h3>Check yourself</h3>
<ol>
<li>A cyclist covers 18 km in 45 minutes. What is her speed in km/h?</li>
<li>A 200 m train passes a pole in 10 seconds. What is its speed in km/h?</li>
</ol>
<details><summary>Answers</summary><p>1. 45 minutes is 0.75 hours, and 18 ÷ 0.75 = 24 km/h.</p><p>2. 200 ÷ 10 = 20 m/s, and 20 × 18/5 = 72 km/h.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Number properties: divisibility, HCF, LCM and remainders',
          minutes: 20,
          topic: 'Number properties',
          html: `<p>Number-system questions test whether you can reason about numbers without long calculation: is this divisible by 11? What is the remainder? What is the last digit of a huge power? A handful of rules, understood rather than memorised, covers most of them.</p>
<h2>Divisibility rules</h2>
<table>
<thead><tr><th>Divisor</th><th>Rule</th><th>Example</th></tr></thead>
<tbody>
<tr><td>2</td><td>Last digit is even</td><td>3,718</td></tr>
<tr><td>3</td><td>Sum of the digits is divisible by 3</td><td>4,512: 4 + 5 + 1 + 2 = 12</td></tr>
<tr><td>4</td><td>Last two digits form a number divisible by 4</td><td>7,316: 16</td></tr>
<tr><td>5</td><td>Last digit is 0 or 5</td><td>2,045</td></tr>
<tr><td>6</td><td>Divisible by both 2 and 3</td><td>4,512</td></tr>
<tr><td>8</td><td>Last three digits form a number divisible by 8</td><td>25,120: 120 = 8 × 15</td></tr>
<tr><td>9</td><td>Sum of the digits is divisible by 9</td><td>8,163: 8 + 1 + 6 + 3 = 18</td></tr>
<tr><td>11</td><td>Difference between the sums of alternate digits is 0 or a multiple of 11</td><td>9,295: (9 + 9) − (2 + 5) = 11</td></tr>
</tbody>
</table>
<p>Why do the rules for 3 and 9 work? Every power of 10 is one more than a multiple of 9 (10 = 9 + 1, 100 = 99 + 1, and so on). So 4,512 = 4 × 1,000 + 5 × 100 + 1 × 10 + 2 leaves the same remainder on division by 9 (or 3) as 4 + 5 + 1 + 2.</p>
<h2>HCF and LCM</h2>
<p>The <strong>HCF</strong> (highest common factor) is the largest number that divides all the given numbers; the <strong>LCM</strong> (least common multiple) is the smallest number that all of them divide. Use prime factors: 24 = 2³ × 3 and 36 = 2² × 3². The HCF takes the lowest power of each common prime, 2² × 3 = 12. The LCM takes the highest power of every prime, 2³ × 3² = 72.</p>
<p>For any two numbers, HCF × LCM = the product of the numbers: 12 × 72 = 864 = 24 × 36. This is useful when a question gives you three of the four values.</p>
<p><strong>Which one is being asked?</strong> "Largest tile", "greatest length that measures exactly", "maximum number of equal groups" → HCF. "When will they next ring, meet or line up together" → LCM.</p>
<p><strong>Worked example.</strong> Three bells ring every 6, 8 and 12 minutes. They ring together at 9:00 a.m. When will they next ring together? LCM(6, 8, 12) = 24, so at 9:24 a.m.</p>
<h2>Remainders and last digits</h2>
<p>You can multiply (or add) remainders before dividing. For the remainder when 47 × 53 is divided by 5, use the remainders 2 and 3: 2 × 3 = 6, which leaves 1. Check: 47 × 53 = 2,491 = 5 × 498 + 1.</p>
<p>Last digits of powers repeat in cycles of at most four. Powers of 7 end in 7, 9, 3, 1, then 7, 9, 3, 1 again. For the last digit of 7<sup>42</sup>, divide 42 by 4: the remainder is 2, so take the second digit of the cycle, 9.</p>
<h2>Primes and counting factors</h2>
<p>To test whether a number is prime, try dividing it by the primes up to its square root. For 221, the square root is just under 15, so try 2, 3, 5, 7, 11 and 13: 221 = 13 × 17, so it is not prime.</p>
<p>A number written as p<sup>a</sup> × q<sup>b</sup> × … in prime factors has (a + 1)(b + 1)… factors. For 72 = 2³ × 3², that is (3 + 1)(2 + 1) = 12 factors.</p>
<h2>Common mistakes</h2>
<ul>
<li>Applying the rule for 4 or 8 to the whole number instead of the last two or three digits.</li>
<li>Mixing up HCF and LCM in word problems.</li>
<li>Calling 1 a prime number. It is not, and 2 is the only even prime.</li>
</ul>
<h3>Check yourself</h3>
<ol>
<li>Is 3,58,248 divisible by 8? Is it divisible by 9?</li>
<li>What is the last digit of 3<sup>25</sup>?</li>
</ol>
<details><summary>Answers</summary><p>1. By 8, yes: its last three digits, 248, equal 8 × 31. By 9, no: its digit sum is 3 + 5 + 8 + 2 + 4 + 8 = 30, which is divisible by 3 but not by 9.</p><p>2. Powers of 3 end in 3, 9, 7, 1. Dividing 25 by 4 leaves 1, so the last digit is the first of the cycle: 3.</p></details>`,
        },
      ],
    },
    {
      title: 'Reasoning',
      summary:
        'Logical reasoning for written tests: number and letter series, coding-decoding, blood relations, seating arrangements and syllogisms, each with a dependable method.',
      lessons: [
        {
          kind: 'article',
          title: 'Number and letter series',
          minutes: 15,
          topic: 'Series',
          html: `<p>Series questions show a sequence and ask for the next term, a missing term or the odd one out. The trick is not brilliance but a checklist: try the common patterns in order until one fits <em>every</em> term.</p>
<h2>A checklist for number series</h2>
<ol>
<li><strong>Differences.</strong> Subtract each term from the next. 5, 9, 13, 17 goes up by 4 each time, so the next term is 21.</li>
<li><strong>Differences of differences.</strong> In 3, 4, 7, 12, 19, the differences are 1, 3, 5, 7 — the odd numbers — so the next difference is 9 and the next term is 28.</li>
<li><strong>Ratios.</strong> 3, 6, 12, 24 doubles each time. In 2, 3, 6, 15, 45 the multipliers are 1.5, 2, 2.5 and 3, so the next is × 3.5, giving 157.5.</li>
<li><strong>Squares and cubes nearby.</strong> 0, 3, 8, 15, 24 are one less than 1, 4, 9, 16, 25. And 2, 9, 28, 65 are one more than 1, 8, 27, 64.</li>
<li><strong>Two series interleaved.</strong> In 4, 20, 6, 17, 8, 14, the odd positions go 4, 6, 8 (up 2) and the even positions go 20, 17, 14 (down 3). The next term is in an odd position, so it is 10.</li>
<li><strong>Mixed operations.</strong> 1, 3, 7, 15, 31 follows "double and add 1", so the next term is 63.</li>
</ol>
<p>Always test your rule against every term, not just the first two or three: several rules can fit the beginning of a series.</p>
<h2>Letter series</h2>
<p>Convert letters to their positions in the alphabet: A = 1, B = 2, …, Z = 26. To find positions quickly, remember E = 5, J = 10, O = 15, T = 20 and Y = 25 (the made-up word "EJOTY" helps).</p>
<p><strong>Worked example.</strong> B, E, I, N, ? The positions are 2, 5, 9, 14, with differences 3, 4, 5. The next difference is 6, giving 20 = T.</p>
<p><strong>Worked example.</strong> AZ, CX, EV, GT, ? The first letters move forward by two (A, C, E, G, so next I) and the second letters move back by two (Z, X, V, T, so next R). The answer is IR.</p>
<h3>Odd one out</h3>
<p>In 121, 144, 169, 196, 210, every number except 210 is a perfect square (11², 12², 13², 14²). Look for the property that all but one of the terms share.</p>
<h2>Common mistakes</h2>
<ul>
<li>Stopping at the first rule that fits two terms.</li>
<li>Counting letter positions on your fingers under time pressure. Write the alphabet with its numbers once on your rough sheet at the start of the test.</li>
<li>Spending five minutes on one stubborn series. Mark it, move on and come back if time allows.</li>
</ul>
<h3>Check yourself</h3>
<ol>
<li>7, 10, 16, 25, 37, ?</li>
<li>Z, W, S, N, ?</li>
</ol>
<details><summary>Answers</summary><p>1. The differences 3, 6, 9, 12 grow by 3, so the next difference is 15 and the answer is 52.</p><p>2. The positions 26, 23, 19, 14 fall by 3, 4 and 5, so the next fall is 6, giving 8 = H.</p></details>`,
        },
        { kind: 'practice', question: 'aptitude-series', topic: 'Series' },
        {
          kind: 'article',
          title: 'Coding-decoding',
          minutes: 15,
          topic: 'Coding-decoding',
          html: `<p>In coding-decoding questions, a word is turned into a code by a hidden rule. Your job is to find the rule and apply it to another word. The rules come from a small family of types, so the fastest approach is to compare the word and its code letter by letter.</p>
<h2>Write the positions under the letters</h2>
<p>Write each letter's position in the alphabet, then compare the word with its code. The common rules are:</p>
<ul>
<li><strong>Shift:</strong> every letter moves forward or back by the same number.</li>
<li><strong>Changing shift:</strong> +1, +2, +3, … or alternating +1 and −1.</li>
<li><strong>Reversal:</strong> the word is written backwards, sometimes with a shift as well.</li>
<li><strong>Opposite letters:</strong> A and Z, B and Y, C and X… The positions of each pair add up to 27.</li>
<li><strong>Numbers:</strong> letters are replaced by their positions, or by sums or products of positions.</li>
</ul>
<h2>Worked examples</h2>
<p><strong>1.</strong> If CODE is written as DPEF, how is MATH written?</p>
<p>C becomes D, O becomes P, D becomes E and E becomes F: each letter moves forward by one. So MATH becomes <strong>NBUI</strong>.</p>
<p><strong>2.</strong> If PAPER is written as SDSHU, how is BOOKS written?</p>
<p>P (16) becomes S (19) and A (1) becomes D (4): each letter moves forward by three. So BOOKS becomes <strong>ERRNV</strong>.</p>
<p><strong>3.</strong> If LIGHT is written as ORTSG, how is DARK written?</p>
<p>L is 12 and O is 15, and 12 + 15 = 27: an opposite pair. Checking the rest confirms it — I and R, G and T, H and S, T and G are all opposite pairs. So DARK becomes <strong>WZIP</strong>.</p>
<p><strong>4.</strong> If GOAL is written as 7-15-1-12, what is the code for BEST? Each letter becomes its position, so BEST is <strong>2-5-19-20</strong>.</p>
<p><strong>5. Sentence codes.</strong> In a code language, "sky is blue" is written "ka lo mi", "blue water flows" is "pe mi ru", and "water is cold" is "ru ka tez". What is the code for "blue"?</p>
<p>"blue" appears in the first two sentences, and the only code word they share is "mi", so blue = <strong>mi</strong>. In the same way, "is" appears in the first and third sentences, which share "ka"; and "water" appears in the second and third, which share "ru".</p>
<h2>Common mistakes</h2>
<ul>
<li>Checking the rule on one letter only. Confirm it on every letter before you apply it.</li>
<li>Forgetting that shifts wrap around the alphabet: Z moved forward by two is B.</li>
<li>Missing a reversal hidden under a shift. If the first letters fit no pattern, compare the first letter of the word with the last letter of the code.</li>
</ul>
<h3>Check yourself</h3>
<p>If TRAIN is written as SQZHM, how is PLANE written?</p>
<details><summary>Answer</summary><p>Each letter moves back by one, and A wraps round to Z. So PLANE becomes OKZMD.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Blood relations',
          minutes: 15,
          topic: 'Blood relations',
          html: `<p>Blood relation questions describe a family in words and ask how two people are related. They feel confusing only when you try to hold everything in your head. Draw the family, and almost every question becomes straightforward.</p>
<h2>Draw a family tree</h2>
<p>Use a simple notation on your rough sheet:</p>
<ul>
<li>Mark each person as male or female — for example a square for male and a circle for female, or the letters M and F.</li>
<li>Join a married couple with a double horizontal line (=).</li>
<li>Put each generation on its own row, parents above children, joined by a vertical line.</li>
<li>Join brothers and sisters with a single horizontal line.</li>
</ul>
<p>With generations in rows, most answers can be read straight off the diagram: one row up holds parents, aunts and uncles; two rows up, grandparents; the same row, siblings, cousins and spouses.</p>
<h2>Words to be precise about</h2>
<ul>
<li>Your father's or mother's brother is your uncle; their sister is your aunt.</li>
<li>Your brother's or sister's son is your nephew; their daughter is your niece.</li>
<li>Your spouse's father is your father-in-law. Your sister's husband and your spouse's brother are both your brothers-in-law.</li>
<li>"Paternal" means on the father's side and "maternal" on the mother's side.</li>
</ul>
<h2>Worked examples</h2>
<p><strong>1.</strong> Pointing to a man in a photograph, Meera says, "His mother is the only daughter of my mother." How is Meera related to the man?</p>
<p>Meera is herself a daughter of her mother, so "the only daughter of my mother" is Meera. The man's mother is therefore Meera: she is his <strong>mother</strong>.</p>
<p><strong>2.</strong> A is the brother of B. B is the daughter of C. D is the father of C. How is A related to D?</p>
<p>B is C's daughter and A is B's brother, so A is C's son. D is C's father, so A is D's <strong>grandson</strong>.</p>
<p><strong>3.</strong> P is the son of Q. R is the sister of Q. S is R's husband. How is S related to P?</p>
<p>R is the sister of P's parent, so R is P's aunt. S is married to R, so S is P's <strong>uncle</strong>.</p>
<p><strong>4. Coded relations.</strong> "A # B" means A is the father of B, "A @ B" means A is the wife of B, and "A % B" means A is the sister of B. What does "P @ Q # R % S" tell you about P and S?</p>
<p>P is Q's wife, Q is R's father, and R is S's sister. So R and S are Q's children, and P, Q's wife, is their mother: P is S's <strong>mother</strong>.</p>
<h3>Gender can be a trap</h3>
<p>"X is the child of Y" does not tell you X's gender. If a question asks how X is related to someone and X's gender is never stated, "cannot be determined" may be the right answer. Do not assume gender from a letter, and be careful even with names unless the question confirms it.</p>
<h2>Common mistakes</h2>
<ul>
<li>Solving in your head and losing track of the generations.</li>
<li>Assuming a gender that the question never gave.</li>
<li>Forgetting that "my father's only son" can be the speaker himself.</li>
</ul>
<h3>Check yourself</h3>
<p>Arun, who has no brothers, introduces a woman: "She is the daughter-in-law of my father's only son's mother." How is the woman related to Arun?</p>
<details><summary>Answer</summary><p>"My father's only son" is Arun himself, so the mother in question is Arun's mother. Her daughter-in-law is the wife of her son — and her only son is Arun. The woman is Arun's <strong>wife</strong>.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Seating arrangements',
          minutes: 20,
          topic: 'Arrangements',
          html: `<p>Seating arrangement questions give you a set of clues about who sits where — in a row or around a table — and then ask several questions about the final arrangement. They reward practice, because one well-drawn diagram answers four or five questions in a row.</p>
<h2>A method that works</h2>
<ol>
<li><strong>Draw the frame first:</strong> a row of numbered seats, or a circle with the seats marked.</li>
<li><strong>Note which way everyone faces.</strong> In a row facing north (towards the top of your page), a person's right is your right as you look at the page. Facing south, it flips.</li>
<li><strong>Place the definite clues first</strong> ("A sits at one end", "B is third from the right"), then the relative ones ("C sits immediately to the right of A").</li>
<li><strong>When a clue allows two positions, draw both cases</strong> and continue each until one breaks a clue.</li>
<li><strong>Re-check every clue</strong> against the final arrangement before answering.</li>
</ol>
<h2>A row: worked example</h2>
<p>Six friends — P, Q, R, S, T and U — sit in a row facing north.</p>
<ul>
<li>R sits at one of the ends.</li>
<li>T sits third to the right of R.</li>
<li>P sits immediately to the left of T.</li>
<li>U does not sit at an end.</li>
<li>S sits immediately to the right of Q.</li>
</ul>
<p>Number the seats 1 to 6 from left to right; facing north, "to the right" means a higher seat number.</p>
<p>If R were in seat 6, nobody could sit to R's right, so R is in seat 1. T, third to the right of R, is in seat 4, and P, immediately to T's left, is in seat 3. That leaves seats 2, 5 and 6 for Q, S and U. Q and S must sit side by side with S on the right, and the only adjacent pair of free seats is 5 and 6, so Q is in seat 5 and S in seat 6. U takes seat 2, which is not an end — as required.</p>
<p>The final row is <strong>R, U, P, T, Q, S</strong>. Who sits between P and Q? T. Who is at the right end? S.</p>
<h2>A circle: worked example</h2>
<p>When people sit around a table facing the centre, each person's left is clockwise and their right is anticlockwise as you look down at your drawing.</p>
<p>Five people — A, B, C, D and E — sit around a round table facing the centre.</p>
<ul>
<li>A sits second to the left of C.</li>
<li>B sits immediately to the right of C.</li>
<li>E does not sit next to B.</li>
</ul>
<p>Rotating everyone round the table does not change a circular arrangement, so you may fix C at the top. Number the other seats 1 to 4 going clockwise from C. Left is clockwise, so A, second to C's left, is in seat 2. B, immediately to C's right (anticlockwise), is in seat 4. D and E take seats 1 and 3. Seat 3 is next to B, so E must be in seat 1 and D in seat 3.</p>
<p>Going clockwise from C, the order is <strong>C, E, A, D, B</strong>. Who sits between A and B? D. Who is immediately to B's left? C — consistent with B being immediately to C's right.</p>
<h2>Common mistakes</h2>
<ul>
<li>Forgetting that left and right flip for people facing south, or facing away from the centre of a circle.</li>
<li>Reading "second to the right" as "immediately to the right".</li>
<li>Committing to a guess early and forcing the remaining clues to fit. Branch into cases instead.</li>
</ul>
<h3>Check yourself</h3>
<p>Four friends sit in a row facing south. On your diagram, drawn with north at the top, Kiran sits at the left-hand end. Who sits immediately to Kiran's right?</p>
<details><summary>Answer</summary><p>Nobody. Facing south, Kiran's right hand points to the left-hand side of your diagram — and Kiran is already at that end. Kiran's left neighbour is the person next to Kiran on the diagram.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Syllogisms: what must follow',
          minutes: 15,
          topic: 'Syllogisms',
          html: `<p>A syllogism question gives you two or more statements, which you must accept as true however odd they sound, and asks which conclusions <em>definitely</em> follow. The key word is "definitely": a conclusion that is only possibly true does not follow.</p>
<h2>Four kinds of statement</h2>
<table>
<thead><tr><th>Statement</th><th>What it means</th><th>In a diagram</th></tr></thead>
<tbody>
<tr><td>All A are B</td><td>Every A is a B</td><td>Circle A inside circle B</td></tr>
<tr><td>No A is B</td><td>Nothing is both</td><td>Separate circles</td></tr>
<tr><td>Some A are B</td><td>At least one A is a B (possibly all)</td><td>Overlapping circles</td></tr>
<tr><td>Some A are not B</td><td>At least one A lies outside B</td><td>Part of A outside B</td></tr>
</tbody>
</table>
<p>"Some" means "at least one", not "only some". If all students are learners, it is still true that some students are learners. Placement tests also assume that every group mentioned has at least one member.</p>
<h2>The Venn diagram method</h2>
<ol>
<li>Draw the simplest diagram of circles that makes every statement true.</li>
<li>For each conclusion, try to draw <em>another</em> valid diagram — one that still satisfies every statement — in which the conclusion is false. If you can, the conclusion does not follow. If you cannot, it does.</li>
</ol>
<h2>Worked examples</h2>
<p><strong>1.</strong> Statements: All coders are learners. All learners are readers.</p>
<p>Conclusions: I. All coders are readers. II. Some readers are coders.</p>
<p>The coders circle sits inside learners, which sits inside readers, so I follows. II follows too: there is at least one coder, and every coder is a reader, so at least one reader is a coder. <strong>Both follow.</strong></p>
<p><strong>2.</strong> Statements: Some phones are cameras. All cameras are lenses.</p>
<p>Conclusions: I. Some phones are lenses. II. All lenses are phones.</p>
<p>The phones that are cameras are also lenses, so I follows. For II, draw a large lenses circle containing the cameras and reaching well outside the phones circle; nothing in the statements forbids it. <strong>Only I follows.</strong></p>
<p><strong>3.</strong> Statements: No pen is a pencil. Some pencils are erasers.</p>
<p>Conclusions: I. Some erasers are not pens. II. No eraser is a pen.</p>
<p>The erasers that are pencils cannot be pens, because no pencil is a pen, so I follows. II does not: the other erasers, outside the pencils circle, may or may not be pens. <strong>Only I follows.</strong></p>
<h3>"Either I or II follows"</h3>
<p>Sometimes neither of two conclusions follows on its own, but they cannot both be false — for example, "Some erasers are pens" and "No eraser is a pen". Between them they cover every possibility, so the answer is "either I or II follows". Look for this when the two conclusions are about the same two groups and form a pair such as "some … are" and "no … is", or "all … are" and "some … are not".</p>
<h2>Common mistakes</h2>
<ul>
<li>Using real-world knowledge instead of the statements. If the statements say "All fish can fly", accept it.</li>
<li>Treating "some" as "some but not all".</li>
<li>Reversing "all": "All coders are learners" does not mean all learners are coders.</li>
</ul>
<h3>Check yourself</h3>
<p>Statements: All trainers are graduates. No graduate is a fresher. Conclusions: I. No trainer is a fresher. II. Some freshers are trainers.</p>
<details><summary>Answer</summary><p>Only I follows. Every trainer is a graduate and no graduate is a fresher, so no trainer can be a fresher. II contradicts I, so it cannot follow.</p></details>`,
        },
      ],
    },
    {
      title: 'Verbal ability',
      summary:
        'The verbal section of written tests: common grammar errors, sentence correction, vocabulary in context, sentence completion, para-jumbles and reading comprehension.',
      lessons: [
        {
          kind: 'article',
          title: 'Spotting errors: agreement, tenses and articles',
          minutes: 15,
          topic: 'Grammar',
          html: `<p>Error-spotting and sentence-correction questions test a small set of grammar rules again and again. You do not need to memorise a grammar book; you need to recognise the half-dozen mistakes examiners love, and to read slowly enough to notice them.</p>
<h2>Subject-verb agreement</h2>
<p>The verb must agree with its real subject, which is not always the noun nearest to it.</p>
<ul>
<li>Wrong: "The list of selected students <em>are</em> on the notice board." Right: "The list of selected students <em>is</em> on the notice board." The subject is "list", not "students".</li>
<li>Wrong: "Each of the trainees <em>have</em> a laptop." Right: "Each of the trainees <em>has</em> a laptop." Each, every, either and neither take singular verbs.</li>
<li>With "either … or" and "neither … nor", the verb agrees with the nearer subject: "Neither the trainer nor the students <em>were</em> late."</li>
</ul>
<h2>Tenses</h2>
<ul>
<li>Use the present perfect when the time is not stated or the action continues to now: "I <em>have completed</em> three projects." With a specific past time, use the simple past: "I <em>completed</em> the project last month" — not "have completed … last month".</li>
<li>"Since" takes a point in time and "for" takes a length of time: "I have been learning Java <em>since</em> June" and "<em>for</em> four months".</li>
<li>Keep tenses consistent within a sentence unless the time really changes.</li>
</ul>
<h2>Articles and common slips</h2>
<ul>
<li>Use "an" before a vowel <em>sound</em>, not just a vowel letter: an hour, an MBA, a university, a one-time password.</li>
<li>Use "the" for something specific or already mentioned: "I built an app. The app tracks attendance."</li>
<li>Some verbs take no extra preposition: we <em>discussed</em> the plan (not "discussed about"), you <em>reply to</em> an email, and you <em>return</em> a book (not "return back").</li>
<li>In emails to an international audience, "I have a question" is clearer than "I have a doubt", and "I will get back to you" is clearer than "I will revert".</li>
</ul>
<h2>Parallel structure and modifiers</h2>
<ul>
<li>Items in a list should share the same form: "I enjoy coding, testing and <em>writing</em> documentation" — not "and to write documentation".</li>
<li>A descriptive phrase at the start of a sentence must describe the subject that follows. Wrong: "Walking into the lab, the computers were all switched off." (The computers were not walking.) Right: "Walking into the lab, I found the computers switched off."</li>
</ul>
<h2>Common mistakes in the test itself</h2>
<ul>
<li>Reading quickly and "hearing" what the sentence should say instead of what it actually says.</li>
<li>Choosing "No error" too readily. Check the agreement, tense, article and preposition in each part before you pick it.</li>
<li>Correcting something that was never wrong because it sounds unfamiliar.</li>
</ul>
<h3>Check yourself</h3>
<p>Find and fix the errors: "The quality of the answers were good, so the trainer discussed about them in class yesterday."</p>
<details><summary>Answer</summary><p>Two errors. The subject is "quality", so the verb is "was"; and "discussed" takes no "about". Corrected: "The quality of the answers was good, so the trainer discussed them in class yesterday."</p></details>`,
        },
        {
          kind: 'article',
          title: 'Vocabulary, sentence completion and para-jumbles',
          minutes: 15,
          topic: 'Vocabulary',
          html: `<p>Vocabulary questions in placement tests rarely ask for rare words. They ask whether you can tell which word fits a sentence, which words are close in meaning, and how sentences fit together into a paragraph. Context is your most useful tool.</p>
<h2>Building a vocabulary that sticks</h2>
<ul>
<li>Read a little every day — a newspaper editorial, a technology blog, a book. Note unfamiliar words together with the sentence you found them in.</li>
<li>Learn common roots: <em>bene</em> (good) in benefit and benevolent; <em>mal</em> (bad) in malfunction and malicious; <em>chron</em> (time) in chronological and synchronise.</li>
<li>Learn words in pairs of opposites: concise and verbose, meticulous and careless, ambiguous and explicit.</li>
<li>Use each new word in a sentence of your own within a day. Words you use are words you keep.</li>
</ul>
<h2>Sentence completion</h2>
<p>Read the whole sentence before looking at the options, and predict what kind of word belongs in the blank. Watch for signal words:</p>
<ul>
<li><strong>Contrast</strong> — but, although, however, despite: the blank opposes something else in the sentence.</li>
<li><strong>Continuation</strong> — and, also, moreover, because: the blank agrees with it.</li>
</ul>
<p><strong>Worked example.</strong> "Although the first version of the app was ______, the team fixed most of its problems within a week." Options: (a) flawless (b) unstable (c) popular (d) expensive.</p>
<p>"Although" signals a contrast with "fixed most of its problems", so the blank must describe something that had problems: <strong>unstable</strong>.</p>
<h2>Para-jumbles</h2>
<p>You are given four to six sentences in random order and must arrange them into a coherent paragraph.</p>
<ol>
<li><strong>Find the opener:</strong> a sentence that introduces the topic and does not depend on anything before it. Sentences beginning with "This", "However", "Such" or a pronoun are rarely openers.</li>
<li><strong>Find linked pairs:</strong> a sentence that says "this method" must come after the one that introduces the method.</li>
<li><strong>Follow time and logic:</strong> problem before solution, general before specific, cause before effect.</li>
<li><strong>Use the options:</strong> once you are sure of one pair, eliminate every option that breaks it.</li>
</ol>
<p><strong>Worked example.</strong> Arrange these sentences: (A) This habit also makes your commits easier to review. (B) Many beginners save their work to version control only once a day. (C) Experienced developers commit small, logical changes instead. (D) As a result, a single commit often mixes several unrelated changes.</p>
<p>B introduces the situation. D ("As a result") follows from B. C offers the contrast, and A ("This habit") refers back to C's practice. The order is <strong>B D C A</strong>.</p>
<h2>Commonly confused words</h2>
<table>
<thead><tr><th>Pair</th><th>Meanings</th></tr></thead>
<tbody>
<tr><td>affect / effect</td><td>Affect is usually a verb (the delay affected us); effect is usually a noun (the effect was serious).</td></tr>
<tr><td>complement / compliment</td><td>To complete or go well with / to praise.</td></tr>
<tr><td>principal / principle</td><td>Main, or the head of a college / a rule or belief.</td></tr>
<tr><td>discreet / discrete</td><td>Careful and tactful / separate and distinct.</td></tr>
<tr><td>stationary / stationery</td><td>Not moving / paper, pens and envelopes.</td></tr>
</tbody>
</table>
<h2>Common mistakes</h2>
<ul>
<li>Choosing a word because it sounds impressive rather than because it fits the sentence.</li>
<li>Missing a "not" or an "although" that flips the meaning.</li>
<li>In para-jumbles, choosing an opener that begins with a pronoun.</li>
</ul>
<h3>Check yourself</h3>
<p>Choose the word that fits: "Her answer was so ______ that the panel asked her to explain it again." (a) lucid (b) ambiguous (c) concise (d) accurate</p>
<details><summary>Answer</summary><p><strong>Ambiguous</strong> — unclear, open to more than one meaning — which is why the panel asked for an explanation. "Lucid" and "concise" suggest the opposite of what the sentence needs.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Reading comprehension without panic',
          minutes: 15,
          topic: 'Reading comprehension',
          html: `<p>Reading comprehension passages can take a large share of the verbal section's time. The aim is not to understand every word but to answer the questions accurately — and the answers are always in the passage, not in your general knowledge.</p>
<h2>Read with a purpose</h2>
<ol>
<li><strong>Glance at the questions first</strong> (not the options), so you know what to look for.</li>
<li><strong>Read the passage once, actively.</strong> After each paragraph, sum it up to yourself in a few words. Note the author's main point and tone.</li>
<li><strong>Answer from the text.</strong> For each question, go back to the relevant lines and test the option against them.</li>
</ol>
<h2>Question types</h2>
<ul>
<li><strong>Main idea:</strong> what the passage as a whole is about. Wrong options are often true details that are too narrow, or claims too broad for the passage.</li>
<li><strong>Specific detail:</strong> find the line; the right option usually restates it in different words.</li>
<li><strong>Inference:</strong> what the author implies without stating it. It must be strongly supported by the text, not merely possible.</li>
<li><strong>Vocabulary in context:</strong> what a word means <em>as used in the passage</em>, which may differ from its most common meaning.</li>
<li><strong>Tone:</strong> critical, optimistic, neutral, cautionary, advisory and so on.</li>
</ul>
<h2>A short worked example</h2>
<blockquote><p>Many students treat their final-year project as a formality, choosing a topic only weeks before the deadline. Yet for a fresher with no work experience, the project is often the only substantial piece of work an interviewer can ask about. A project chosen early, built with care and documented clearly gives a candidate something concrete to discuss; a rushed one can become the weakest part of an otherwise strong interview.</p></blockquote>
<ul>
<li><strong>Main idea:</strong> the final-year project deserves real effort, because interviewers use it to judge freshers.</li>
<li><strong>Tone:</strong> advisory, and mildly critical of current habits.</li>
<li><strong>A supported inference:</strong> the author would advise starting the project early.</li>
<li><strong>Not supported:</strong> "interviewers ignore marks" — the passage never says so.</li>
</ul>
<h2>Traps to watch for</h2>
<ul>
<li><strong>Extreme words</strong> in an option — always, never, only, entirely — usually make it wrong, unless the passage is just as extreme.</li>
<li><strong>True but irrelevant:</strong> an option may state a fact you know, but if the passage does not support it, it is wrong.</li>
<li><strong>Half right:</strong> an option that starts correctly and then adds something the passage did not say.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Reading the passage three times before looking at a single question.</li>
<li>Answering from a memory of the passage instead of checking the lines.</li>
<li>Spending too long on one hard passage when the next one is easier.</li>
</ul>
<h3>Check yourself</h3>
<p>Which is the best title for the passage above? (a) How to Choose a Project Topic (b) The Final-Year Project as an Interview Asset (c) Why Freshers Fail Interviews (d) Documentation in Software</p>
<details><summary>Answer</summary><p>(b). Options (a) and (d) are too narrow — each covers a single detail — and (c) is too broad and too negative, since the passage is about one specific factor.</p></details>`,
        },
      ],
    },
    {
      title: 'Communication',
      summary:
        'Professional communication: speaking with structure, writing emails that get answered, and the everyday etiquette of meetings, chat messages and feedback at work.',
      lessons: [
        {
          kind: 'article',
          title: 'Speaking clearly: structure before you speak',
          minutes: 12,
          topic: 'Speaking',
          html: `<p>Clear speaking is less about accent or vocabulary and more about structure. Interviewers, managers and clients all respond to the same thing: a speaker who says the main point first, supports it briefly and then stops. You can practise this deliberately.</p>
<h2>Point first</h2>
<p>Start with your answer or conclusion, then give the reasons or details. Compare:</p>
<ul>
<li><strong>Story first:</strong> "So on Monday I started looking at the logs, and then on Tuesday I thought it might be the database, and then…" — the listener waits a minute to find out what happened.</li>
<li><strong>Point first:</strong> "The report was slow because a database index was missing. I found it from the query logs, added the index, and the report now loads in two seconds instead of forty."</li>
</ul>
<p>The second version takes fifteen seconds and answers the question in its first sentence.</p>
<h2>Structures worth practising</h2>
<ul>
<li><strong>PREP</strong> for opinions: Point, Reason, Example, Point again. "We should add automated tests before the next feature. Manual testing took us two days last time. For example, the fee bug we shipped would have been caught by a single test. So, tests first."</li>
<li><strong>Past, present, future</strong> for updates and introductions: what you did, what you are doing now, what comes next.</li>
<li><strong>Signposted points:</strong> "There are three reasons. First… Second… Finally…" Listeners remember structure.</li>
</ul>
<h2>Delivery</h2>
<ul>
<li><strong>Pace:</strong> nerves make people speak fast. Pause at full stops; a short silence sounds confident, not empty.</li>
<li><strong>Clarity over accent:</strong> everyone has an accent. What matters is that each word is clear and each sentence is complete.</li>
<li><strong>Fillers:</strong> "basically", "actually", "like", "you know". Record yourself speaking for two minutes and count them — awareness alone reduces them.</li>
<li><strong>Body language:</strong> sit upright, keep your hands visible and calm, and look at the listener (or at the camera on a video call).</li>
</ul>
<h2>When you do not know</h2>
<p>"I'm not sure, but this is how I would find out…" is a strong answer. Bluffing is not, and experienced listeners spot it at once. If you did not understand a question, ask: "Do you mean the database design or the API design?"</p>
<h2>Common mistakes</h2>
<ul>
<li>Memorising answers word for word: they sound recited, and they collapse when the question changes slightly.</li>
<li>A long build-up before the point.</li>
<li>Using heavy technical jargon with a listener who is not technical.</li>
</ul>
<h3>Check yourself</h3>
<p>Your trainer asks, "Why is your project late?" Write a two-sentence, point-first answer.</p>
<details><summary>Answer</summary><p>For example: "It is two days behind because the payment module took longer to test than I planned. Testing is now finished, and I will submit the complete project by Thursday." The reason comes first and the plan second — no long story and no excuses.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Writing professional emails',
          minutes: 15,
          topic: 'Email',
          html: `<p>Email is still the main written channel between you and recruiters, trainers, managers and clients. A good email is easy to answer: within two lines, the reader knows what you need and by when. A poor one gets left for "later", which often means never.</p>
<h2>The anatomy of a good email</h2>
<ul>
<li><strong>A subject line</strong> that says what the email is about and, if needed, what you want: "Request: extension for the Library API assignment to 14 March". Avoid "Hi", "Doubt" or an empty subject.</li>
<li><strong>A greeting:</strong> "Dear Ms Iyer," or "Hello Mr Thomas," for formal mail, and "Hi Ravi," for people you work with daily. Avoid "Dear Sir/Madam" when you know the person's name.</li>
<li><strong>The purpose in the first sentence.</strong> State your request or the key information immediately.</li>
<li><strong>The body:</strong> only the context the reader needs, in short paragraphs or a short list.</li>
<li><strong>A clear ask and deadline:</strong> what you need from them, and by when.</li>
<li><strong>A closing:</strong> "Thank you," or "Regards," followed by your full name and any details they may need, such as your batch or roll number.</li>
</ul>
<h2>An example</h2>
<pre class="language-text"><code class="language-text">Subject: Request: two-day extension for the Library API assignment

Dear Ms Iyer,

I am writing to request a two-day extension, to 14 March, for the
Library API assignment.

I was unwell from Monday to Wednesday (medical certificate attached).
I have completed the book and member endpoints; the remaining work is
the loan endpoints and their tests.

Could you let me know by tomorrow whether the extension is possible?

Thank you,
Kavya Menon
Batch JFS-B2, Roll No. 27</code></pre>
<h2>Tone</h2>
<ul>
<li>Polite and direct beats elaborate. "Could you please…" is enough; you do not need three lines of apology.</li>
<li>Avoid capital letters for emphasis (they read as shouting), strings of exclamation marks, text-speak such as "pls" and "u", and emojis in formal mail.</li>
<li>Never send an email written in anger. Draft it, wait an hour, and read it again.</li>
</ul>
<h2>Before you press Send</h2>
<ul>
<li>Are the recipients right? Use CC for people who need to be informed, not for everyone. Use BCC when writing to a group whose members should not see each other's addresses.</li>
<li>Is the attachment actually attached, sensibly named (<code>Kavya_Menon_Resume.pdf</code>, not <code>final2.pdf</code>), and a PDF if it is a document to read?</li>
<li>Have you spelt the recipient's name correctly?</li>
<li>Before "Reply all": does everyone on the thread really need your reply?</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Burying the request in the last paragraph.</li>
<li>Writing from an unprofessional address. Use one based on your name.</li>
<li>Following up after an hour. For non-urgent mail, wait two or three working days, then reply politely on the same thread.</li>
</ul>
<h3>Check yourself</h3>
<p>Rewrite this subject line so that it is useful: "doubt".</p>
<details><summary>Answer</summary><p>Make it specific, for example "Question about the submission format for the SQL assignment". The reader should know the topic before opening the email.</p></details>`,
        },
        { kind: 'practice', question: 'career-email-first-sentence', topic: 'Email' },
        {
          kind: 'article',
          title: 'Workplace etiquette: meetings, chat and feedback',
          minutes: 12,
          topic: 'Workplace etiquette',
          html: `<p>Technical skill gets you hired; how you work with people decides how quickly you are trusted with more. Workplace etiquette is mostly about respecting other people's time and attention, and it is easy to learn.</p>
<h2>Time and commitments</h2>
<ul>
<li>Join meetings on time, and a minute or two early for interviews and client calls.</li>
<li>If you are going to miss a deadline, say so <strong>early</strong>, with the reason and a new date. Bad news shared early is a planning problem; bad news shared on the deadline is a trust problem.</li>
<li>Do what you said you would. If you said "I'll check and get back to you", get back — even if only to say you are still checking.</li>
</ul>
<h2>Meetings and video calls</h2>
<ul>
<li>Read the agenda and come prepared.</li>
<li>Mute when you are not speaking, switch your camera on if the team does, and choose a quiet place with a plain background.</li>
<li>Do not talk over others. If you have a point, raise your hand (or use the raise-hand button) and wait for a gap.</li>
<li>When actions are agreed, note who will do what by when, and share the list afterwards if nobody else does.</li>
</ul>
<h2>Chat messages</h2>
<ul>
<li>Do not send just "Hi" and wait. Put the greeting and the question in one message: "Hi Arjun, could you review my pull request for the report fix today? It is small, about 40 lines."</li>
<li>Ask work questions in the team's shared channels where you can, so that others can help and learn from the answer.</li>
<li>Respect working hours. If you must message late, make it clear that it can wait until morning.</li>
</ul>
<h2>Giving and receiving feedback</h2>
<ul>
<li><strong>Receiving:</strong> listen fully, ask questions to understand, say thank you and act on it. You do not have to agree with everything, but defending yourself immediately teaches people to stop giving you feedback.</li>
<li><strong>Giving:</strong> be specific and talk about the work, not the person: "The report page took twelve seconds to load in my test" rather than "your code is slow".</li>
</ul>
<h2>Professional boundaries</h2>
<ul>
<li>Keep your organisation's and clients' information confidential, including on social media.</li>
<li>Treat everyone — security staff, housekeeping, interns and senior leaders — with the same courtesy.</li>
<li>Avoid jokes about anyone's gender, religion, caste, region, language or background. What feels harmless to you may not feel harmless to them.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Staying silent for days when stuck, then admitting it on the deadline.</li>
<li>Using chat for a long, complicated discussion that would take five minutes on a call.</li>
<li>Forwarding an email chain without reading what is further down in it.</li>
</ul>
<h3>Check yourself</h3>
<p>On Tuesday you realise that a task due on Thursday will need until Monday. What do you do, and when?</p>
<details><summary>Answer</summary><p>Tell your lead on Tuesday, not on Thursday. Explain briefly why, give a realistic new date, and offer options — for example, delivering the most important part by Thursday and the rest on Monday.</p></details>`,
        },
      ],
    },
    {
      title: 'Resume and group discussion',
      summary:
        'A one-page resume that shows what you have built, a code profile and portfolio that back it up, and how to contribute well in group discussions on any type of topic.',
      lessons: [
        {
          kind: 'article',
          title: 'Building a one-page fresher resume',
          minutes: 20,
          topic: 'Resume',
          html: `<p>A recruiter's first look at a resume is usually brief. In that time they want to see three things: what you can do, what you have built, and whether you meet the basic requirements. A fresher's resume should fit on one page and make those three things easy to find.</p>
<h2>The sections, in order</h2>
<ol>
<li><strong>Header:</strong> your name, phone number, a professional email address, your city, and links to your code profile or portfolio if they contain real work. Leave out a photo, date of birth, religion and parents' names unless an application specifically asks for them.</li>
<li><strong>Summary (optional, two lines):</strong> "Computer science graduate who has built three Java and Spring Boot applications, including a REST API with automated tests. Looking for a backend developer role."</li>
<li><strong>Skills:</strong> grouped and honest. Languages: Java, SQL, JavaScript. Frameworks: Spring Boot, React. Tools: Git, Maven, Docker (basics).</li>
<li><strong>Projects:</strong> two to four, the most relevant first. For a fresher, this is often the most important section.</li>
<li><strong>Education:</strong> degree, college, year and score, with class XII and X briefly.</li>
<li><strong>Internships, certifications and achievements:</strong> only those that add something.</li>
</ol>
<h2>Bullet points that show impact</h2>
<p>Start each bullet with an action verb, say what you did, and add a result or a number wherever you honestly can.</p>
<table>
<thead><tr><th>Weak</th><th>Stronger</th></tr></thead>
<tbody>
<tr><td>Worked on a library project</td><td>Built a library management REST API in Spring Boot with 12 endpoints for books, members and loans</td></tr>
<tr><td>Did testing</td><td>Wrote 45 JUnit tests covering fine calculation and loan limits; found and fixed two boundary bugs</td></tr>
<tr><td>Responsible for database</td><td>Designed a normalised six-table PostgreSQL schema and wrote the queries for the overdue-books report</td></tr>
</tbody>
</table>
<p>Useful verbs include built, designed, implemented, automated, reduced, tested, deployed, led and documented.</p>
<h2>Format</h2>
<ul>
<li>One page, in a clean single-column layout with consistent fonts, headings and dates. Heavy colours, text boxes and graphics often confuse the software many employers use to read resumes.</li>
<li>Send it as a PDF named <code>Firstname_Lastname_Resume.pdf</code>.</li>
<li>No spelling mistakes. Read it aloud, then ask someone else to read it.</li>
<li>Tailor it: reorder your skills and projects to match each role you apply for.</li>
</ul>
<h2>Honesty is not optional</h2>
<p>Everything on your resume is a question waiting to be asked. List Docker, and expect "What is the difference between an image and a container?" A skill you cannot discuss does more harm than good, so rate yourself honestly — "basics" is a perfectly good word.</p>
<h2>Common mistakes</h2>
<ul>
<li>An objective that says nothing, such as "To work in a challenging environment that utilises my skills".</li>
<li>Listing every technology from every semester.</li>
<li>Project descriptions that say what the app does but not what <em>you</em> did in the team.</li>
<li>Two or three pages for a fresher.</li>
</ul>
<h3>Check yourself</h3>
<p>Improve this bullet: "Made a website for college fest."</p>
<details><summary>Answer</summary><p>For example: "Built and deployed the registration website for our college technical festival using React and a Node.js API; it handled 900 online registrations over two weeks." It says what you built, with what, and the result — and every number must be true.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Showing your work: code profile and portfolio',
          minutes: 12,
          topic: 'Portfolio',
          html: `<p>A resume says what you have built; a well-kept public profile on a code-hosting site, or a personal portfolio page, lets the reader check it. For a fresher with no work experience, this evidence can set you apart — but only if what is there is tidy, honest and your own.</p>
<h2>Choose a few projects, and finish them</h2>
<p>Three complete, well-presented projects are worth more than fifteen half-finished tutorial copies. Pin your best ones to the top of your profile. A good set for a backend-focused fresher might be a REST API with a database and tests, a small full-stack application, and one project of your own idea that solves a real problem.</p>
<h2>A README for every project</h2>
<p>The README is the first thing a visitor reads. It should answer:</p>
<ul>
<li><strong>What is it?</strong> One or two sentences, plus a screenshot if it has a screen.</li>
<li><strong>What did you use?</strong> Language, framework, database and tools.</li>
<li><strong>How do I run it?</strong> The exact steps, from download to running.</li>
<li><strong>What is interesting about it?</strong> A design decision, a hard problem you solved, what you would improve next.</li>
<li><strong>Who built what?</strong> For a team project, say clearly which parts were yours.</li>
</ul>
<h2>Signals reviewers notice</h2>
<ul>
<li>Meaningful commit messages, and a history that shows the work growing over time rather than one giant upload.</li>
<li>Tests, and an automated build that passes.</li>
<li>No build output in the repository and, above all, <strong>no passwords or keys</strong>. A secret in a public repository is a serious red flag.</li>
<li>A live link where possible, so someone can try the project without installing anything.</li>
</ul>
<h2>Honesty and credit</h2>
<ul>
<li>If a project follows a tutorial or a course, say so, and describe what you added or changed.</li>
<li>Never copy someone else's project and present it as your own. Interviewers ask detailed questions, and the gap shows quickly.</li>
<li>If you used an AI assistant substantially, be ready to explain every part of the code anyway.</li>
</ul>
<h2>Professional networking profiles</h2>
<p>If you keep a profile on a professional networking site, make it consistent with your resume: the same dates and projects, a clear photo, and a headline that says what you do ("Java backend developer — Spring Boot, SQL"). Share what you build and learn, briefly and without exaggeration.</p>
<h2>Common mistakes</h2>
<ul>
<li>Dozens of forked or empty repositories that bury your real work.</li>
<li>A project that no longer runs because its setup steps were never written down.</li>
<li>Links on your resume that lead to a private or deleted page. Check every link before you apply.</li>
</ul>
<h3>Check yourself</h3>
<p>A reviewer opens your project and finds a README that only says "Library project". Name three things you should add.</p>
<details><summary>Answer</summary><p>Any three of: what it does (with a screenshot), the technologies used, step-by-step instructions to run it, your own role if it was a team project, the interesting design decisions, and a live link.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Group discussions: what evaluators look for',
          minutes: 15,
          topic: 'Group discussion',
          html: `<p>In a group discussion (GD), eight to twelve candidates discuss a topic for fifteen to twenty minutes while evaluators watch. It is not a debate to be won and not a contest to see who speaks most. The evaluators are asking one question: would this person be good to work with in a team?</p>
<h2>What is being assessed</h2>
<ul>
<li><strong>Content:</strong> relevant points, facts and examples, and an awareness of more than one side.</li>
<li><strong>Communication:</strong> clear, concise, audible speech.</li>
<li><strong>Listening:</strong> building on what others say instead of repeating or ignoring it.</li>
<li><strong>Leadership:</strong> moving the discussion forward — not controlling it.</li>
<li><strong>Composure:</strong> staying calm and polite when others interrupt or disagree.</li>
</ul>
<h2>Ways to contribute well</h2>
<ul>
<li><strong>Opening:</strong> if you start, define the topic briefly and suggest how to approach it: "We could look at this from the students' side, the employers' side and the cost side." Only open if you have something to say; a weak opening hurts more than a later entry.</li>
<li><strong>Adding value:</strong> bring a new angle, a fact or an example. "Building on what Neha said about cost, there is also the question of who maintains the system afterwards."</li>
<li><strong>Bringing others in:</strong> "Farhan, you mentioned smaller colleges earlier — what do you think?" Evaluators notice this.</li>
<li><strong>Steering:</strong> if the group goes round in circles, summarise and move on: "We seem to agree on the benefits; shall we look at the risks?"</li>
<li><strong>Summarising:</strong> if asked to sum up, cover the group's main points fairly, including the views you disagreed with.</li>
</ul>
<h2>Getting a word in</h2>
<p>In a lively GD, wait for a natural pause or the end of someone's sentence, start with a short phrase that signals you are joining — "I'd like to add one point…" — and speak a little louder than in normal conversation. Make your first sentence the point itself. Three short, useful contributions are better than one long speech.</p>
<h2>Disagreeing politely</h2>
<p>Try "I see that point, but there is another side to it…" or "That may work in big cities; I'm not sure it works in smaller towns, because…". Disagree with ideas, never with people, and never raise your voice.</p>
<h2>Common mistakes</h2>
<ul>
<li>Shouting over others or cutting them off mid-sentence.</li>
<li>Speaking without substance just to be heard: "I agree with everyone."</li>
<li>Staying silent for the whole discussion.</li>
<li>Quoting statistics you are not sure of. If in doubt, say "roughly" or leave the number out.</li>
<li>Addressing the evaluators instead of the group.</li>
</ul>
<h3>Check yourself</h3>
<p>Two candidates are arguing loudly, and the rest of the group has gone quiet. What could you say?</p>
<details><summary>Answer</summary><p>Something that lowers the temperature and moves things forward: "You have both made strong points — one about cost and one about access. Could we hear from those who haven't spoken yet, and then look at possible solutions?" It acknowledges both sides, brings others in and steers the discussion.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Preparing for group discussion topics',
          minutes: 12,
          topic: 'Group discussion',
          html: `<p>You rarely know a GD topic in advance, but topics fall into a few familiar types, and a simple way of generating points on the spot works for almost all of them.</p>
<h2>Types of topic</h2>
<ul>
<li><strong>Society and current affairs:</strong> "Should coding be taught from primary school?"</li>
<li><strong>Technology and business:</strong> "Will AI tools create or reduce jobs for freshers?"</li>
<li><strong>Abstract:</strong> a single word or phrase, such as "Bridges" or "Red". There is no right reading; the group decides what to make of it.</li>
<li><strong>Case-based:</strong> a short situation with a decision to make, such as a college choosing between two uses for a limited budget.</li>
</ul>
<h2>Generating points in two minutes</h2>
<p>Groups usually get a minute or two to think. Use a quick framework so your mind does not go blank:</p>
<ul>
<li><strong>Stakeholders:</strong> who is affected? Students, parents, teachers, employers, government, the environment.</li>
<li><strong>Angles:</strong> social, economic, technological, ethical, legal.</li>
<li><strong>Time:</strong> short term versus long term.</li>
<li><strong>Both sides:</strong> two benefits, two risks and one possible middle path.</li>
</ul>
<p>Jot down keywords on your sheet, not full sentences.</p>
<h2>A worked example</h2>
<p><strong>Topic:</strong> "Should colleges allow students to use AI assistants for assignments?"</p>
<ul>
<li><strong>For:</strong> it mirrors the workplace; students get instant explanations; it frees time for deeper projects.</li>
<li><strong>Against:</strong> students may skip the fundamentals; fair assessment becomes harder; student data may be shared with outside services.</li>
<li><strong>Stakeholders:</strong> students, faculty, and employers who need real skills.</li>
<li><strong>Middle path:</strong> allow it with disclosure, test understanding through a viva or live coding, and set clear rules for each assignment.</li>
</ul>
<p>With a map like this, you can join the discussion at any point with something useful.</p>
<h2>Abstract topics</h2>
<p>For a topic like "Bridges", offer an interpretation early and link it to something concrete: bridges as infrastructure, bridges between people (communication), or bridges between college and industry (internships). The group will usually pick up a thread and develop it.</p>
<h2>Preparing over the weeks before</h2>
<ul>
<li>Read an editorial page or a reliable news summary a few times a week, and note two facts on each major issue.</li>
<li>Practise with friends: a fifteen-minute GD followed by five minutes of honest feedback for each person.</li>
<li>Record a practice discussion and listen to how often you spoke, for how long, and whether you built on others' points.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Preparing memorised speeches on popular topics and delivering them whatever the group is discussing.</li>
<li>Covering only one side of a topic.</li>
<li>Treating an abstract topic as a trick and saying nothing.</li>
</ul>
<h3>Check yourself</h3>
<p>Topic: "Work from home is here to stay." Note one stakeholder, one benefit, one risk and one middle path.</p>
<details><summary>Answer</summary><p>For example — stakeholder: employees with long commutes; benefit: time and travel costs saved; risk: less hands-on mentoring for freshers; middle path: hybrid work, with fixed office days for team activities and training.</p></details>`,
        },
      ],
    },
    {
      title: 'The interview',
      summary:
        'Preparing for interview day, introducing yourself, thinking aloud in technical rounds, answering HR questions with the STAR method, asking good questions and following up.',
      lessons: [
        {
          kind: 'article',
          title: 'Preparing for interview day',
          minutes: 10,
          topic: 'Interview day',
          html: `<p>Much of a good interview happens before it starts. Arriving calm, prepared and on time lets you spend your energy on the questions instead of on avoidable problems.</p>
<h2>The day before</h2>
<ul>
<li>Re-read the job description and your own resume. Every line on your resume is fair game.</li>
<li>Revise the fundamentals for the role, and walk through your main project aloud: what it does, how it is built, your part, a hard problem you solved, and what you would improve.</li>
<li>Prepare your documents: printed copies of your resume, ID, and mark sheets or certificates if asked, plus a pen and a notebook.</li>
<li>Check the venue and the travel time — or, for an online interview, the meeting link and the platform.</li>
<li>Sleep. Cramming late into the night costs more than it gains.</li>
</ul>
<h2>Dress and arrival</h2>
<p>Dress neatly in formal or smart-casual clothes, clean and ironed, unless you have been told otherwise. Arrive about fifteen minutes early. Be courteous to everyone you meet, from the receptionist to the other candidates — people do notice.</p>
<h2>Online interviews</h2>
<ul>
<li>Test your camera, microphone and connection beforehand, and keep a phone hotspot ready as a backup.</li>
<li>Choose a quiet, well-lit place with a plain background. Light should fall on your face from the front, not from behind you.</li>
<li>Look at the camera when you speak. Close other applications and silence notifications.</li>
<li>Keep water, a notebook and your resume within reach.</li>
<li>If the connection drops, rejoin quickly and calmly, and send a short message to the recruiter if needed.</li>
</ul>
<h2>Managing nerves</h2>
<p>Some nervousness is normal, and even useful. Slow breathing before you go in, a short pause before each answer, and a sip of water all help. Remember that interviewers want you to do well: a good hire solves their problem.</p>
<h2>Common mistakes</h2>
<ul>
<li>Arriving rushed, or joining a video call late because of a software update.</li>
<li>Not knowing the details of your own resume.</li>
<li>Scrolling on your phone in the waiting area instead of collecting your thoughts.</li>
</ul>
<h3>Check yourself</h3>
<p>List three things to check fifteen minutes before an online interview.</p>
<details><summary>Answer</summary><p>For example: the camera and microphone working in the meeting app, a stable connection with a backup ready, notifications silenced and other apps closed, good light on your face, and your resume and notebook at hand.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Introducing yourself in under two minutes',
          minutes: 12,
          topic: 'Introducing yourself',
          html: `<p>"Tell me about yourself" is the most common opening question in interviews, and the one candidates most often waste by reciting their resume. It is your chance to set the direction of the conversation, so prepare it — but do not memorise it word for word.</p>
<h2>A simple structure: present, past, future</h2>
<ol>
<li><strong>Present (about 15 seconds):</strong> who you are now. "I'm Karthik, a computer science graduate from Coimbatore, and I have just completed a full-stack Java training programme."</li>
<li><strong>Past (about 60 seconds):</strong> one or two things you have built or done that matter for this role, with your own part in them. "My strongest project is a hostel management system built with Spring Boot and PostgreSQL. I designed the database and wrote the fee and room-allocation modules, including their tests…"</li>
<li><strong>Future (about 15 seconds):</strong> what you want next and why this role fits. "I enjoy backend work, especially designing APIs, and I'm looking for a role where I can grow in that direction."</li>
</ol>
<p>That comes to about ninety seconds: long enough to be complete, and short enough to invite follow-up questions.</p>
<h2>What to include and what to leave out</h2>
<ul>
<li><strong>Include</strong> what connects to the job: projects, skills, an internship, something you taught yourself.</li>
<li><strong>Mention briefly, or not at all,</strong> school marks, family details and hobbies — unless a hobby says something useful about you, such as running a coding club or years of competitive chess.</li>
<li><strong>Avoid</strong> repeating every line of your resume; the interviewer already has it.</li>
</ul>
<h2>Leave hooks for follow-up questions</h2>
<p>Mention one or two things you would be glad to be asked about. If you say "I fixed a tricky bug where two students could be given the same room", the interviewer will probably ask about it — and you will be ready with a strong story. You are steering the conversation towards your strengths.</p>
<h2>Delivery</h2>
<ul>
<li>Practise aloud, with a timer, until the structure feels natural even though the exact words vary.</li>
<li>Smile, make eye contact and speak at a steady pace.</li>
<li>Prepare a thirty-second version as well, for when time is short.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Starting with "My name is …, I am from …, my father is…" and running out of time before reaching any project.</li>
<li>Sounding recited. If you lose your place in a memorised script, you freeze.</li>
<li>Claiming skills you cannot discuss: the next question will be about them.</li>
</ul>
<h3>Check yourself</h3>
<p>Write your own "past" section in three sentences: one project, your part in it, and one result.</p>
<details><summary>Answer</summary><p>There is no single right answer. Check yours: does it name a specific project, say clearly what <em>you</em> did rather than only what the team did, and end with an outcome — a feature working, a bug fixed, a number improved? If so, it is ready to practise aloud.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Technical interviews: thinking aloud',
          minutes: 15,
          topic: 'Technical interview',
          html: `<p>A technical interview checks two things: what you know, and how you think when you do not know straight away. The second matters as much as the first. Interviewers would rather hear a candidate reason carefully towards a decent answer than watch one guess in silence.</p>
<h2>What to expect</h2>
<ul>
<li><strong>Fundamentals:</strong> object-oriented concepts, collections, exceptions, SQL queries and joins, HTTP and REST basics, Git.</li>
<li><strong>Your projects:</strong> why you chose a design, what was hard, what you would change. Know every technology you have listed.</li>
<li><strong>Problem solving:</strong> a small coding problem on paper, a whiteboard or a shared editor.</li>
<li><strong>Reading and debugging code:</strong> "What does this print?" or "What is wrong with this method?"</li>
</ul>
<h2>Solving a coding problem in front of someone</h2>
<ol>
<li><strong>Restate the problem</strong> and ask about anything unclear: the size of the input, empty input, duplicates, negative numbers.</li>
<li><strong>Work through a small example by hand</strong> before writing any code.</li>
<li><strong>Explain your approach aloud</strong>, starting with a simple one even if it is slow: "The straightforward way is two nested loops, which is O(n²). Could a HashSet make it faster?"</li>
<li><strong>Write clean code</strong> with meaningful names, explaining as you go.</li>
<li><strong>Test it</strong> by walking through your example and an edge case. Find your own bugs before the interviewer does.</li>
<li><strong>State the complexity</strong>, in time and in space.</li>
</ol>
<h2>Answering concept questions</h2>
<p>Give a short definition, then an example, then a practical point. "What is an interface? A type that declares methods which implementing classes must provide. For example, <code>List</code> is an interface, and <code>ArrayList</code> and <code>LinkedList</code> implement it. In my project I declared variables as <code>List</code>, so I could change the implementation without changing the code that used them."</p>
<h2>When you are stuck</h2>
<ul>
<li>Say what you do know and reason from there: "I haven't used that annotation, but from its name I would expect it to…"</li>
<li>Ask for a hint. Good interviewers give them, and using a hint well counts in your favour.</li>
<li>Never pretend. "I don't know, but I would check the documentation and try it" is honest and acceptable — once or twice.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Two minutes of silence, then a finished answer — or no answer at all.</li>
<li>Jumping into code before understanding the question.</li>
<li>Not knowing the details of your own project.</li>
</ul>
<h3>Check yourself</h3>
<p>You are asked whether an array contains any duplicate value. Describe two approaches and their complexity.</p>
<details><summary>Answer</summary><p>Compare every pair with two nested loops: O(n²) time and O(1) extra space. Or add each element to a <code>HashSet</code> and stop as soon as an add fails: O(n) time on average and O(n) extra space. A third option is to sort first and compare neighbours, in O(n log n) time.</p></details>`,
        },
        {
          kind: 'article',
          title: 'HR interviews and the STAR method',
          minutes: 15,
          topic: 'HR interview',
          html: `<p>The HR or managerial round asks about you rather than your code: how you handle pressure, work in a team, deal with mistakes and make decisions. Many questions begin "Tell me about a time when…". The best answers are short, true stories — and the STAR method gives them a shape.</p>
<h2>STAR: situation, task, action, result</h2>
<ul>
<li><strong>Situation:</strong> the context, in one or two sentences.</li>
<li><strong>Task:</strong> what you were responsible for, or what had to be achieved.</li>
<li><strong>Action:</strong> what <em>you</em> did, step by step. This is the longest part, so say "I", not only "we".</li>
<li><strong>Result:</strong> what happened — with a number if possible — and what you learned.</li>
</ul>
<h2>A worked example</h2>
<p><strong>Question:</strong> "Tell me about a time you faced a difficult problem in a project."</p>
<ul>
<li><strong>Situation:</strong> "In our final-year project, four of us built an attendance system. Two weeks before the review, it started showing wrong attendance percentages for some students."</li>
<li><strong>Task:</strong> "I had written the calculation module, so I took responsibility for finding the cause."</li>
<li><strong>Action:</strong> "I reproduced the problem with a student who had joined late and found that the code divided by all the classes in the term instead of the classes held after the student joined. I fixed the formula, wrote tests for late joiners and for students with no classes yet, and asked a teammate to review the change."</li>
<li><strong>Result:</strong> "The percentages then matched the paper register for all 60 students we checked. Since then, I write boundary tests before I consider any calculation finished."</li>
</ul>
<p>Spoken, this takes about a minute and a half. It is specific, shows ownership and ends with a lesson.</p>
<h2>Prepare five stories</h2>
<p>Most behavioural questions can be answered from a small set of stories prepared in advance:</p>
<ol>
<li>A technical problem you solved.</li>
<li>A disagreement in a team, and how it was resolved.</li>
<li>A mistake or failure, and what you changed afterwards.</li>
<li>A time you learned something new quickly.</li>
<li>A time you led or helped others.</li>
</ol>
<h2>Common HR questions</h2>
<ul>
<li><strong>"What are your strengths and weaknesses?"</strong> Give a real strength, with evidence. For a weakness, name a real one that is not central to the job, and say what you are doing about it.</li>
<li><strong>"Why should we hire you?"</strong> Connect two or three of your strengths to what the role needs.</li>
<li><strong>"Where do you see yourself in five years?"</strong> Show ambition that fits the path the role offers: deeper skills and more responsibility.</li>
<li><strong>"Are you willing to relocate or work in shifts?"</strong> Answer honestly; if you have constraints, explain them politely.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Giving hypothetical answers ("I would…") when the question asks about something that actually happened.</li>
<li>Stories where "we" did everything and your own part is invisible.</li>
<li>Blaming teammates, trainers or your college.</li>
<li>Inventing stories. Follow-up questions expose them quickly.</li>
</ul>
<h3>Check yourself</h3>
<p>Which part of a STAR answer should take the most time, and why?</p>
<details><summary>Answer</summary><p>The action. It shows what you actually did and how you think; the situation and task only set the scene, and the result is a short close.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Questions to ask, and following up',
          minutes: 10,
          topic: 'Closing the interview',
          html: `<p>Near the end of almost every interview you will hear, "Do you have any questions for us?" Answering "No, nothing" wastes a final chance to show interest and judgement. A thoughtful question — and a polite follow-up afterwards — leaves a good last impression.</p>
<h2>Questions worth asking</h2>
<ul>
<li>"What would someone joining this role work on in the first few months?"</li>
<li>"How does the team review code and share knowledge?"</li>
<li>"What does a successful first year look like for someone in this position?"</li>
<li>"Which technologies does the team use most, and is there anything you would recommend I learn before joining?"</li>
<li>A follow-up on something said during the interview: "You mentioned the team is moving its services to containers — how is that going?"</li>
</ul>
<p>Good questions are about the work, the team and how you can succeed. Prepare three, because one or two may be answered during the interview itself.</p>
<h2>Questions to avoid or postpone</h2>
<ul>
<li>Anything you could have found on the organisation's own website.</li>
<li>Pay, leave and benefits during an early technical round. They matter, but they are usually discussed with HR at the offer stage.</li>
<li>"Have I been selected?" The panel usually cannot tell you on the spot.</li>
</ul>
<h2>Closing well</h2>
<p>Thank the interviewers, by name if you know them. One short, sincere sentence is enough: "Thank you for your time — I enjoyed the discussion about the API design, and I'm keen on this role."</p>
<h2>Following up</h2>
<ul>
<li>If you have the recruiter's email address, a brief thank-you within a day is appropriate. Keep it to three or four lines.</li>
<li>If you were given a timeline and it has passed, one polite follow-up after a few working days is fine.</li>
<li>Write down the questions you found hard and study those topics before your next interview. This is how interview performance improves.</li>
</ul>
<h2>After a rejection</h2>
<p>Every candidate faces rejections; they are part of the process, not a verdict on you. If feedback is offered, accept it gratefully. Review what went well and what did not, practise the weak area, and move on to the next opportunity.</p>
<h2>Common mistakes</h2>
<ul>
<li>Asking a question only for the sake of asking, then not listening to the answer.</li>
<li>Sending several follow-up emails in the same week.</li>
<li>Letting one bad interview knock your confidence for the next one.</li>
</ul>
<h3>Check yourself</h3>
<p>Why is "What does your company do?" a weak question to ask at the end of an interview?</p>
<details><summary>Answer</summary><p>It shows you did not prepare: the answer is on the organisation's own website. Ask about the work, the team or how to succeed in the role instead.</p></details>`,
        },
        { kind: 'practice', question: 'career-questions-to-ask', topic: 'Closing the interview' },
      ],
    },
  ],
  assignments: ['Placement Readiness'],
  tests: [
    {
      title: 'Aptitude and Placement Readiness — practice test',
      kind: 'practice',
      description:
        'A short practice round mixing quantitative aptitude, reasoning and professional judgement. Take it after the Numbers and Reasoning modules, and again before your placement rounds.',
      durationMinutes: 20,
      sections: [
        {
          title: 'Aptitude and reasoning',
          questions: ['aptitude-percentage', 'aptitude-time-work', 'aptitude-series'],
        },
        {
          title: 'Communication and interviews',
          questions: ['career-email-first-sentence', 'career-questions-to-ask'],
        },
      ],
    },
    {
      title: 'Aptitude and Placement Readiness — mock assessment',
      kind: 'mock',
      description:
        'A mock round in the style of a campus selection process: timed aptitude questions, two professional-judgement questions, and two written answers — introducing yourself and describing a problem you solved using the STAR method — reviewed by the placement team.',
      durationMinutes: 45,
      sections: [
        {
          title: 'Aptitude',
          questions: ['aptitude-percentage', 'aptitude-time-work', 'aptitude-series'],
        },
        {
          title: 'Professional judgement',
          questions: ['career-email-first-sentence', 'career-questions-to-ask'],
        },
        {
          title: 'Written answers',
          questions: ['career-introduce-yourself', 'career-project-star'],
        },
      ],
    },
  ],
};
