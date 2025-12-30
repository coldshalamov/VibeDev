---

---


Code Agents are State of the Art Software Testers
Niels Mündler1, Mark Niklas Müller1,2, Jingxuan He1, Martin Vechev1
1 Department of Computer Science, ETH Zurich 2 LogicStar.ai
{niels.mundler, mark.mueller, jingxuan.he, martin.vechev}@inf.ethz.ch 1
mark@logicstar.ai 2
Abstract
Rigorous software testing is crucial for developing and maintaining high-quality
code, making automated test generation a promising avenue for both improving
software quality and boosting the effectiveness of code generation methods. How-
ever, while code generation with Large Language Models (LLMs) is an extraor-
dinarily active research area, test generation remains relatively unexplored. We
address this gap and investigate the capability of LLM-based Code Agents for
formalizing user issues into test cases. To this end, we propose a novel bench-
mark based on popular GitHub repositories, containing real-world issues, ground-
truth patches, and golden tests. We find that LLMs generally perform surprisingly
well at generating relevant test cases with Code Agents designed for code repair
exceeding the performance of systems designed specifically for test generation.
Further, as test generation is a similar but more structured task than code genera-
tion, it allows for a more fine-grained analysis using fail-to-pass rate and coverage
metrics, providing a dual metric for analyzing systems designed for code repair.
Finally, we find that generated tests are an effective filter for proposed code fixes,
doubling the precision of SWE-A GENT .
1 Introduction
As the complexity of software systems increases, rigorous testing is becoming more important than
ever to ensure their reliability and correctness. However, manually writing high-quality tests is a
time-consuming and cumbersome process. Therefore, automatic test-case generation from informal
natural language descriptions is not only a particularly interesting path toward improving both code
quality and developer productivity but also promises to boost the effectiveness of automatic code
repair tools which can leverage generated tests as formal specifications.
However, while automatic code generation, in particular using Code Agents, is an extremely active
research area [1–8], there is comparatively little work investigating automatic test generation di-
rectly. Indeed, while prior work has proposed methods based on symbolic execution [9], specialized
transformers [10], and general-purpose LLMs [11–15], Code Agents have not been considered in
this context. In particular, large-scale, diverse test-generation datasets are lacking for Python, which
is the focus of current Code Agent research.
A Benchmark for Test Generation In this work, we propose theSoftWare Testing bench, SWT-
BENCH , a novel and comprehensive dataset for test generation in Python, containing over1 700sam-
ples, each consisting of a GitHub issue, a golden patch fixing the issue, and a set of golden reference
tests, obtained by transforming the popular SWE-B ENCH [16] from code repair to test generation.
Our key insight is that any code repair task can be transformed into a test generation task, even in
the absence of golden tests, by leveraging the golden patch for evaluation. Concretely, for every
generated test, we determine whether it reproduces the described issue, by checking whether it fails
on the original repository but passes after the golden patch is applied. We illustrate this evaluation
process of SWT-B ENCH in Fig. 1. Additionally, we propose a more fine-grained evaluation metric
based on the coverage the generated tests achieve on the code modified by the golden patch.
arXiv:2406.12952v1  [cs.SE]  18 Jun 2024

Fail Pass
Pass Pass
Fail Fail
Pre PR Post PR
isValid currently allows
trailing newlines but only
alphanumeric characters
should be accepted.
Codebase (Pre PR)
Task inputs Generated Tests
isValid("name") == False 
isValid("name") == True 
isValid("name\n") == False 
Figure 1: Evaluation of an SWT-B ENCH instance. Given an issue description in natural language
and the corresponding codebase, the task is to generate tests that reproduce the issue. We considered
a test to reproduce the issue if it fails on the codebase before the pull request (PR) is accepted, i.e.,
before the golden patch is applied, but passes after. We call this a fail-to-pass test (F →P).
Benchmarking Test Generation Methods We evaluate various existing approaches on SWT-
BENCH , including directly prompting state-of-the-art LLMs to generate tests for the given issue, the
state-of-the-art test generation method L IBRO [13], and different Code Agents adapted to the task
of test generation [1, 3]. Interestingly, we find that despite being designed for code repair, the Code
Agent SWE-A GENT outperforms all other methods at test generation, both reproducing more issues
and achieving higher coverage. However, we still observe significant complementarity between the
different approaches, with an ideal ensemble of the best three methods solving 88% more samples
than the best single method. Further, while the performance on code repair and test generation is
generally correlated, this does not hold on a per-sample basis, indicating that generating a test for
and fixing a given issue are distinct tasks of different difficulty. Finally, we find that generated tests
can serve as a strong signal for the correctness of proposed code fixes, with SWE-AGENT achieving
twice the precision on fixes that pass self-generated tests that failed before the fix was applied.
Key Contributions Our key contributions are:
• We introduce SWT-B ENCH , a new benchmark for test generation based on an extensive dataset
of real-world software repositories, user issues, code patches, and test cases (§3).
• We propose to adapt Code Agents to the task of test generation (§4).
• We provide an extensive evaluation of SWT-B ENCH , and demonstrate that Code Agents excel at
test generation, outperforming all prior methods (§5).
2 Related Work
Code Datasets Over recent years, a variety of code datasets such as HumanEval [17], APPS [18],
and MBPP [19] have been proposed to assess the capabilities of code synthesis and repair systems
[20, 21]. However, these largely focus on interview-style coding challenges or function-level code
synthesis and do not capture the complexity of real-world codebases. Further, they have been shown
to often include insufficient test cases to properly assess the correctness of the generated code [22].
Recently, a range of repository-level code-generation benchmarks [23, 24] including the popular
SWE-B ENCH [16] have emerged as modern LLMs began to saturate the simpler function-level
benchmarks. However, none of these benchmarks were designed to assess test generation.
The only dataset for bug localization and program repair that is based on real-world issues, Defects4J
[25], focuses on Java, is limited in size, and contains only short bug descriptions rather than detailed
issue reports. In contrast, SWT-B ENCH is based on Python, which is better supported by modern
Code Agents, contains detailed issue reports, and is significantly larger.
Automated Unit Test Generation Many approaches have been suggested to automate (unit) test
generation leveraging symbolic execution [9], specialized transformers [10], and general purpose
LLMs [7, 8, 10–15]. Depending on their focus, they can be used to increase test coverage [7, 12],
find edge cases [9] or reproduce user bugs [13]. We evaluate the most recent applicable method
(LIBRO [13]) and a range of other LLM-based approaches on SWT-B ENCH .
Code Agents Over the last year, LLMs have been equipped with tools to observe and interact
with their environment over multiple turns and preserve a state across these turns [26–30]. These
so-called Agents have proven successful on a range of complex tasks, including code repair and
2

synthesis [1–6]. Such Code Agents can typically search, read, and edit code using an agent computer
interface (ACI) [1]. In this work, we leverage such Code Agents for automatic test generation by
changing their instructions. Specifically, we adapt SWE-A GENT [1] and AUTO CODE ROVER [3].
3 Benchmarking Test Generation
In this section, we outline the structure of the proposed benchmark, SWT-B ENCH , and how we
leverage it to measure the capabilities of LLMs and Code Agents.
3.1 Notation and Definitions
We first introduce the notation to describe codebases, their test suites, and changes to these codebases
in the form of patches. We denote a codebase R after applying patch X as R ◦ X. Several patches
can be applied sequentially, i.e. R ◦ X ◦ Y is the codebase R after applying a first patch X and
then a second one Y . Initially, the codebase R contains a possibly empty test suite SR. When a new
patch is applied to R, a set of new testsT is usually added to check the correctness of the introduced
patch and prevent regression.
A test s can either pass (P) or fail (F) after we execute it within the context of R. We consider a test
to fail if an error is thrown after execution, e.g., anAssertionErroror ValueError. Such test errors
frequently occur if R lacks or misimplements the functionality captured by the test. They can also
occur due to other reasons, such as incorrect syntax or formatting of the added test. Conversely, a
test passes when running the test triggers no error. We define this process as an execution function:
exec(s, R) ∈ {P, F}.
We consider a test s to successfully reproduce a described issue of R if it fails on the original
codebase (i.e. exec(s, R) = F) but passes on the patched codebaseR◦X (i.e. exec(s, R◦X) = P).
We denote these tests, by slight abuse of notation, with F →P. Further, we consider the set of new
tests T to be successful if it contains at least one F → P test and no test that fails on the patched
codebase, or formally (∃s ∈ T, exec(s, R) = F) ∧ (∀s ∈ T, exec(s, R◦ X) = P).
3.2 Benchmark Overview Table 1: Characterization of different attributes
of SWT-B ENCH instance.
Mean Max
Issue Text # Words 315.1 8756
Codebase # Files 210.1 384
# Lines 52330.8 122605
Existing Tests
#F→P 0.05 55
#F→F 1.5 98
#P→P 91.4 4837
#P→F 0.3 40
# total 105.1 4842
Coverage 32.3% 67.7%
Golden Tests
#F→P 1.5 952
#F→F 0.0 5
#P→P 1.6 766
#P→F 0.0 0
# added 2.8 750
# removed 0.3 104
To construct SWT-B ENCH , we leverage the
same underlying data as SWE-B ENCH [16] and
summarize its three-stage construction process
here for completeness’ sake.
1. Scrape a total of ∼90 000pull requests
(PRs) from 12 popular open-source
Python repositories from GitHub.
2. Filter PRs to only include those that
were merged, resolved a GitHub issue,
and made changes to a test file.
3. Filter PRs to feature at least one F →P
test, removing PRs that result in instal-
lation or runtime errors.
This results in 2 294task instances, each consisting of a GitHub issue, a golden patch X∗ fixing the
issue, and a set of golden reference tests T∗.
However, we find that the test suite used in the sphinx library is incompatible with the python
tracemodule which we use to measure coverage. We thus exclude the187 corresponding instances
from our benchmark. For an additional 345 instances the golden patch can not be evaluated without
errors or does not fix the described issue, i.e., that the number of failing tests in SR◦X∗◦T∗ does
not decrease compared to SR◦T∗. We exclude these as well, leaving a total of 1 762 instances in
SWT-B ENCH . To enable cheaper evaluation we create SWT-B ENCH -LITE , a subset of 253 issues,
corresponding to SWE-B ENCH -LITE .
3

scikit-learn
psf
pallets
sympy
astropy
pydata
mwaskom
pytest-dev
matplotlib
django
pylint-dev
Figure 2: Distribution of SWT-
BENCH instances over repositories.
We summarize key statistics of SWT-B ENCH in Table 1 and
show its repository composition in Fig. 2. While issue de-
scriptions are on average only 315 words long, the longest
one reaches 8756 words. Generally, repository complexity is
high with on average 210 files and over 50 000 lines of code.
Many repositories feature large test suites of > 90 and up
to 4800 tests, covering a third of the entire code base. Most
of these existing tests are unaffected by the golden patch with
only 0.05 F →P and 0.3 P →F tests on average. The golden
tests remove on average0.3 tests and add another2.8 new test
cases, of which roughly half are F →P and P →P each.
3.3 Metrics
We propose two main metrics to evaluate the test generation performance of any method, Fail-to-
Pass rate (F →P) and change coverage (C), described below.
Fail-to-Pass Rate The Fail-to-Pass rate ( F → P) measures the portion of instances where the
generated tests reproduced the issue, i.e., at least one test failed on the original codebase and all
passed on the fixed version. This is the most important performance measure asF →P tests are key
for test-driven development and automatic code generation.
def isValid(name):
   """ check digit """
   digitInFront = match(
  r"\d+.*",
  name
   )
   if digitInFront:
  print("has digit")
  return False
   return True
def isValid(name):
   """ check d & n """
   digitInFront = match(
  r"\d+.*",
  name
   )
   trailNewl = newl(name)
   if trailNewl:
  print("trail newl")
   if digitInFront:
  print("has digit")
  return digitInFront
   return trailNewl
+
+
Figure 3: Illustration of change coverage ∆C
of the generated tests T, given the original
code base R, the golden patch X, and the
golden tests T∗.
Change Coverage Coverage is an important met-
ric to determine what portion of a codebase is tested.
While path coverage measures this best, the expo-
nential number of paths makes it infeasible in prac-
tice. We thus follow common practice and instead
measure line coverage. As we aim to specifically
test the bug described in the issue text, we consider
only the coverage of the changes made by the golden
patch. Further, we observe that some patches include
large portions of unexecutable lines, e.g. documen-
tation or configuration files, and exclude them from
our analysis. Specifically, we consider all lines that
are executed by the original test suite with and with-
out the golden test to be executable. Finally, we con-
sider both the coverage of removed (including modified) lines of code in the original codebase and
added (including modified) lines of code in the patched codebase. We illustrate this in Fig. 3.
Formally, given the number of times CSR(l) ∈ Z≥0 a specific line of code l was executed when
running the test suite S on the codebase R, we define the executable lines of the patch X as
X∗
r = {l ∈ Xr | CSR(l) + CSR◦T∗ (l) > 1}
X∗
a = {l ∈ Xa | CSR◦X (l) + CSR◦X◦T∗ (l) > 1},
where Xr and Xa are the lines added and removed by patch X, respectively, and T∗ is the golden
test patch. Finally, we obtain the change coverage of the generated tests T as
∆CX(T) =
P
l∈X∗a
1CSR◦X◦T (l)>CSR◦X (l) + P
l∈X∗r
1CSR◦T (l)>CSR(l)
|X∗r | + |X∗a | .
Where X and T are clear from context, we drop them for notational clarity. If none of the lines
modified by the golden patch X are executed by any test, i.e., |X∗
r | + |X∗
a | = 0, we exclude this
instance from our coverage analysis (43.1% of cases).
Patch Applicability Many LLMs struggle to generate valid code patch files [16] and the methods
we investigate employ different approaches to mitigate this issue. To assess them, we additionally
measure the patch applicability A as the portion of instances for which a valid patch was generated.
4

1 -- demo/file.py
2 +++ demo/file.py
3 @@-4,5 +4,5 @@
4 def test_euclidean(a, b):
5 - assert euclidean(1, 0) == 1
6 + assert euclidean(100, 10) == 10
7 assert euclidean(1, 1) == 1
1 demo/file.py
2 rewrite
3 1
4 def test_euclidean(a, b):
5 assert euclidean(100, 10) == 10
6 assert euclidean(1, 1) == 1
7 end diff
Figure 4: Comparison of the default unified diff format (left) and our fault-tolerant version (right).
4 Automatic Test Generation
We first discuss how the test generation task differs from code repair, before introducing a novel
code diff format based on these insights that is optimized for fault tolerance. Finally, we propose a
range of test generation methods based on directly querying LLMs and leveraging Code Agents.
4.1 Test Generation vs Code Repair
Automatic test generation is closely related to code repair: Instead of predicting a patchX that fixes
the described issue and is then evaluated using a golden test T∗, we aim to predict one or multiple
reproducing tests T which are then evaluated on both the original codebaseR and after applying the
golden patch X∗. However, there are some key differences between the two tasks: First, adapting an
existing test suite to reproduce an issue typically only requires adding new tests. Concretely, 71%
of golden tests in SWT-B ENCH only add new test functions, with another 28% modifying existing
functions, and only 1% removing functions. Second, testing permits and requires a more granular
analysis. While fixed code is either correct and passes all test cases or incorrect when failing any of
them, generated tests can be correct but irrelevant to the issue (P →P), call relevant code but fail to
expose the precise bug (increase in coverage), reproduce the issue with varying comprehensiveness
on edge cases (F →P, with varying coverage), or fail in a variety of different ways.
4.2 A Code Diff Format for Automatic Test Generation
Code changes are typically represented in the unified diff format, i.e., in the git patch and diff
format. While using this format to represent code changes is both precise and human-readable, it
is very sensitive to misspecifications, requiring, e.g., the exact line numbers of code changes to be
specified and specific code snippets (including all to-be-changed lines) to be repeated verbatim. As
a result, many LLMs struggle to produce valid patch files [16] with, e.g., GPT-4 only succeeding in
16% of cases, resulting in only 1 correctly reproduced issues.
To alleviate this issue, we propose an adjusted patch format optimized for LLM generation that is
easier to adhere to and more robust. Specifically, our custom diff format allows entire functions
or classes to be inserted, replaced, or deleted, given the full function or class definition and (fault-
tolerant) location in the code. We show an example in Fig. 4, comparing it to the unified diff format.
Based on whether the model wants to rewrite an existing function or insert a new function, the
provided code is then substituted or inserted at the code location. This format is particularly well
suited for test generation which usually only requires adding test functions. We provide a more
formal description of this format in App. A and demonstrate its effectiveness in §5.
4.3 Direct LLM Generation of Tests
We consider four baselines for test generation: Direct zero-shot prompting with the unified patch
format (ZERO SHOT), zero-shot prompting with our novel patch format (ZERO SHOT PLUS ), using an
oracle to select the best of 5 generations (PASS @5), and the state-of-the-art test generation method,
LIBRO [13], which uses a range of heuristics to pick the most promising among multiple generated
tests. In all methods, the LLM is instructed to add tests to reproduce and cover the described issue
in the codebase. We describe these methods below, deferring further details to App. B.
ZERO SHOT prompts the model with the issue description, a subset of the codebase retrieved using
BM-25 [31], and instructions to generate a patch file in unified diff format.
5

ZERO SHOT PLUS is similar to Z ERO SHOT but leverages our custom diff format, discussed in §4.2,
which is optimized for LLMs and robustness to minor specification errors.
PASS @5 uses our ZERO SHOT PLUS prompting scheme to generate 5 proposal tests and then uses an
oracle to pick the best one. While this is of course not practical in a real-world setting, it allows us to
assess the potential of the LLM to generate good test cases given an effective selection mechanism.
LIBRO [13], is the current state-of-the-art for LLM-based test generation. Similar to PASS @5 it gen-
erates multiple proposal tests. However, instead of using an oracle, it combines multiple heuristics
to select the best test cases. In particular, it runs all generated tests and then selects the one inducing
an error that is most similar to the problem description. This permits not only checking whether a
generated diff is valid and the proposed test fails on the original codebase but also selecting the most
relevant test case. As Libro was originally proposed for Java, we adapt it to our Python setting.
Adapting LIBRO to our Setting Kang et al. [13] originally proposed LIBRO for an evaluation in
a pass@k setting. There, it is useful to rank all generated tests to improve performance at k > 1.
As we only consider pass@1, we drop ranking components irrelevant for the top-1 test in our reim-
plementation. Further, L IBRO includes heuristics for importing missing dependencies and inserting
tests into the correct classes. While effective in Java, this is superfluous for Python, where tests can
be added outside classes and dependency imports are (empirically) correctly generated by the LLM.
We thus also drop these components.
LIBRO clusters test cases based on whether the generated execution trace matches the issue descrip-
tion. As exact matching is often not applicable for the unstructured issue descriptions, we measure
the similarity between the error message and the issue description by extracting the execution trace
of the generated test cases and querying the same LLM used for test generation to judge whether they
relate to the same issue. Depending on its answer, we obtain two clusters and choose the shortest
result of the preferred cluster.
4.4 Code Agents for Test Generation
LLM-based agents are systems that take actions based on LLM-generated text, providing tools to
observe and interact with their environment over multiple turns and preserve some state across these
turns. In the case of Code Agents, they can typically search, read, and edit code using an agent
computer interface (ACI) [1]. Recent work has shown that such Code Agents are particularly effec-
tive for complex repository-level code synthesis and repair tasks, outperforming unaided LLMs by
a significant margin [1–5]. In this work, we leverage Code Agents for automatic test generation by
adjusting their instructions. Specifically, we adapt SWE-A GENT [1] and AUTO CODE ROVER [3].
SWE-A GENT [1] provides the LLM direct access to (augmented) command line tools and pre-
processes their output to be more easily parseable by the LLM. In particular, they provide special
tools for searching, viewing, and editing files. Beyond this, they provide little guardrails or structure
for the LLM beyond initial instructions and let the model interact with a limited shell environment.
AUTO CODE ROVER [3] separates the code repair task into two distinct stages. In the first stage, the
LLM is tasked with collecting relevant context for the task at hand. To this end, it is equipped with
a range of advanced code search and navigation tools, allowing it, e.g., to retrieve class signatures,
function definitions, or surrounding code snippets. In the second stage, the LLM is tasked with
generating the actual code patch in a single step, retrying only if the patch can not be applied.
Adapting Code Agents for Test Generation As SWE-A GENT and A UTO CODE ROVER were
designed for program repair, we adapt their system and instruction prompts to focus on creating
high-quality test cases. We find that the underlying LLMs are capable of following these changed
instructions and successfully generate test cases for up to 96% of issues. Typically, the instruction
changes were as simple as replacing a phrase like "solve this issue" with "create unit tests that cover
the issue". We provide a more detailed description of the used prompts in App. B.
We experiment with instructing SWE-A GENT explicitly to execute the generated test cases before
returning them and reminding the agent if it forgets to do so. We call this variant SWE-A GENT +
and find that this increases the F →P rate from 9.9% to 11.1% (see Table 2).
6

5 Experimental Evaluation
We use SWT-B ENCH to compare the performance of test generation methods (§5.2), their interac-
tion with the code repair setting (§5.3), and the impact of different instance characteristics (§5.3).
5.1 Experimental Setup
We consider GPT-4 (gpt-4-1106-preview)[32], Claude 3 Haiku [33], and Mixtral 7x22b [34] (served
by Together AI [35]), as underlying LLMs, using GPT-4 unless indicated otherwise. We sample at
temperature t = 0 for all zero-shot methods and at t = 0.7 for L IBRO and PASS @5. For SWE-
AGENT and AUTO CODE ROVER , we use their default settings, restricting the number of API calls
to 20 and interaction rounds to 10, respectively. For L IBRO we generate 5 tests for the heuristics to
choose from. Due to budget constraints, we focus our evaluation on SWT-B ENCH -LITE .
5.2 Automatic Test Generation
Table 2: Rate of valid patches (A), fail-to-any tests (F →
×), reproducing fail-to-pass tests ( F → P), and correct
but unhelpful pass-to-pass tests (P →P), all in %.
Method A(↑) F→×(↑) F→P (↑) P→P
PASS@5 85.4 32 .0 11.5 53.4
ZEROSHOT 16.2 6 .7 0 .4 9 .5
ZEROSHOTPLUS 77.1 32 .0 6 .3 45 .1
LIBRO 79.4 36 .8 9 .1 42 .7
AUTOCODEROVER 77.1 38.3 7.5 38 .7
SWE-AGENT 96.4 36.4 9 .9 60 .1
SWE-AGENT+ 94.9 34 .0 11.1 60.9
Comparing Test Generation Methods
We compare test generation performance
in Table 2 where all methods have ac-
cess only to the issue description and
the original codebase. We observe
that using the original git code-diff for-
mat, Z ERO SHOT only generates valid
patches for 16.2% of issues. Using
our novel test-specific code-diff format
(ZERO SHOT PLUS ) boosts this rate to
77.1% yielding a 15x increase in F →P
rate to 6.3%. While picking the best
among five generated tests (P ASS @5) even yields 11.5%, the heuristics employed by L IBRO can
only convert about half of this gap into an F → P rate of 9.1%, still beating A UTO CODE ROVER
which achieves an F → P rate of 7.5%. SWE-A GENT , however, outperforms L IBRO at 9.9%
F →P rate, increased to 11.1%, when instructed to check its generated tests (SWE-A GENT +). In-
terestingly, SWE-A GENT produces fewer initially failing tests than AUTO CODE ROVER and LIBRO
despite having almost perfect applicability and yielding a higher F →P rate.
We conclude that general-purpose Code Agents already outperform domain-specific test generation
methods, with test-specific agents promising further improvements.
Table 3: Change Coverage∆C [%] as defined
in §3.3 aggregated over F → P instances,
none F →P instances, and all instances.
Method ∆Call ∆CF→P ∆C¬(F→P)
GOLDEN 45.1 45 .1 -
PASS@5 7.3 38 .2 3 .6
ZEROSHOTPLUS 8.5 48 .9 6 .1
LIBRO 10.8 33 .8 8 .6
AUTOCODEROVER 12.3 51 .9 8 .6
SWE-AGENT 15.5 56.8 8.9
SWE-AGENT+ 14.4 47 .2 8 .7
Coverage of Generated Tests We analyze the
change coverage ∆C of the generated tests, i.e., the
portion of executable golden patch code that is cov-
ered by the generated tests, in Table 3. Across all
methods, we observe a significantly higher cover-
age on F → P instances, indicating that coverage
is indeed a good but more granular measure of test
quality. Interestingly, SWE-A GENT + achieves no-
tably lower coverage than SWE-AGENT , especially
on F → P instances, highlighting the potential of
providing agents with more test-generation-specific
tools to identify promising tests. Further, L IBRO achieves substantially lower coverage than the
Code Agents, most likely as a consequence of preferring shorter tests.
Table 4: Comparison of different underlying
LLMs for SWE-A GENT .
Model A(↑) F→×(↑) F→P (↑) P→P
GPT-4 96.4 36 .4 9 .9 60 .1
Haiku 42.7 12 .6 0 .8 30 .0
Mixtral 10.3 3 .2 0 .0 7 .1
Model Effect We compare the effect of different
underlying LLMs for SWE-A GENT in Table 4. We
observe that not onlyF →P rate but even applicabil-
ity (A) is highly sensitive to the underlying LLM’s
performance, with both Haiku and Mixtral achieving
significantly lower performance than GPT-4.
7

5.3 Code Repair and Test Generation
Table 5: ZERO SHOT PLUS , given the test files
to change, the golden ( ✓) or an incorrect ( ✗)
code fix, and the files modified by the golden
(✓) or incorrect fix (✗). Rate of valid patches
(A), F →×, F →P, and P →P, all in %.
Test Files Patch A F→× F→P P →P
- - - 80.1 36 .0 4 .4 44 .1- ✓ ✓ 97.1 73 .5 10 .3 23 .5- ✗ ✗ 77.9 39 .7 6 .6 38 .2✓ - - 94.1 80 .9 15 .4 13 .2✓ ✓ ✓ 96.3 75 .7 16 .9 20 .6✓ ✗ ✗ 96.3 81 .6 13 .2 14 .7
Test Generation for a Given Code Patch To as-
sess the effectiveness of automatic test generation
at testing specific, provided fixes, we investigate
the effect of providing a (possibly incorrect) code
patch, the files it changed, and the test file to be
modified instead of the files retrieved with BM25,
reporting results in Table 5. We use Z ERO SHOT-
PLUS to generate incorrect patches, resampling ≤5
times and excluding instances where we could not
generate an incorrect but applicable patch, reducing
the sample size to n = 136. We observe that while
providing the test files to change, almost triples
F → P from 4.4% to 15.4%, exceeding the best Code Agents, providing a code patch and the
files it changed has a much smaller impact, increasing F → P only to 10.3% for the golden patch
and 6.6% for an incorrect patch. This highlights the importance of retrieving the correct context for
generating relevant tests.
Filtering Code Fixes with Generated Tests State-of-the-art code generation methods only re-
solve around 20% of cases on SWE-B ENCH -LITE . Without suitable tests to distinguish correct
from incorrect fixes, the overhead from manual testing [36] would thus outweigh any benefits from
automatic code generation. To address this issue, we use SWE-AGENT to generate both patches and
tests. We then filter the generated patches, retaining only those with generated F →P tests. While
only achieving 10% recall, this more than doubles the precision of SWE-A GENT to 45%, making it
significantly more practically useful and highlighting the importance of test generation.
Table 6: Overlap in solved SWE-B ENCH
and SWT-B ENCH .
SWT SWE Overlap p-Value [%]
ZEROSHOTPLUS 16 16 1 65.6SWE-AGENT 25 48 5 53.4
Correlation of Test Generation and Code Repair
We analyze the overlap between solved instances of
SWE-B ENCH and SWT-B ENCH , showing results in
Table 6. We observe that the overlap is small for both
methods, with no statistical evidence of correlation
(p-values of 65.6% and 53.4% for ZERO SHOT PLUS
and SWE-A GENT , respectively, under the null hypothesis of independence and uniform hardness),
indicating that generating tests and fixes are distinct tasks of different difficulties. Further, we ob-
serve that while general-purpose LLMs solve the same number of instances in both tasks, code
agents solve only half as many SWT as SWE-B ENCH instances, highlighting the potential for the
development of test-specific agents.
astropydjango
matplotlibmwaskom
pallets
psf
pydata
pylint-devpytest-devscikit-learn
sympy
0
5
10
15
20
25
30
35
% Resolved
SWE Bench
SWT Bench
Figure 5: Distribution of F →P rates across reposito-
ries for different test generation methods.
Distribution over Repositories We
compare the success rate of SWE-A GENT
for test and fix generation across reposito-
ries in Fig. 5. Despite a significantly lower
overall success rate, we observe that test
generation is not uniformly harder than
fix generation. Instead, it obtains similar
success rates across four repositories, and
higher success rates on an additional two.
However, there are significantly more
(five) repositories where test generation
fails entirely while code repair only fails
on two. Manually inspecting instances
from these repositories where test generation fails, we find pydata has a particularly complex
codebase and makes heavy use of parameterization and fixtures in their testing, pytest-dev, a
testing tool, naturally has a highly unusual testing setup as it aims to test other tests, and pallets
has extremely long golden test lengths indicating particularly challenging testing problems. For
pylint-dev generated tests are all P →P making them correct but unhelpful.
8

5.4 Test Generation Success and Instace Characteristics
≤100 ≤200 ≤500 >500
0
2
4
6
8
10
12
% Resolved
ZeroShotPlus
LIBRO
AutoCodeRover
SWE-Agent
Figure 6: Distribution of F →P rates across issue descrip-
tion lengths in # tokens
Effect of Issue Description Length
We investigate the relationship be-
tween issue description length and
test generation performance in Fig. 6.
We observe a general trend that issues
with longer descriptions are easier to
generate tests for, with all methods
achieving a higher F → P rate for
longer descriptions. This is likely due
to the increased amount of informa-
tion available in longer descriptions.
Interestingly, only A UTO CODE ROVER , which specializes in relevant context recovery, achieves a
non-zero F → P rate on the shortest issue descriptions, further supporting this hypothesis. SWE-
AGENT , which is able to interact with the codebase across multiple turns, is least sensitive to issue
description length, achieving approximately the same F →P rate for all but the shortest lengths.
14 82
9
5 5
4
SWE-Agent AutoCodeRover
LIBRO
Figure 7: Overlap in instances solved by the three
best performing methods.
Model Complimentarity We consider three
diverse models from §5.2 and analyze the
overlap in the instances for which they are
able to generate successful tests. We show
the results in Fig. 7. While the best-
performing approach, SWE-A GENT , alone is
only able to solve 25 instances, the combina-
tion of all three approaches is able to solve
47 instances. Interestingly, the overlap be-
tween the two relatively similar agent-based
approaches A UTO CODE ROVER and SWE-
AGENT is smaller than between either one and
the test-generation specific LIBRO .
6 Limitations
While our novel SWT-B ENCH covers a wide range of real-world issues, it has several limitations:
It is limited to Python, which may limit the generalizability of our findings to other programming
languages. Second, the dataset is based on popular GitHub repositories, which may not be represen-
tative of common software development practices. Finally, the dataset is limited to issues resolved
with the golden patch where coverage could be measured, which may induce selection biases.
Further, while our adapted Code Agents outperform methods designed for test generation, they are
still notably less effective at generating tests than repairing code. As agents get developed for test
generation, they might overcome some limitations we have observed in our evaluation. Therefore,
our work should be understood as highlighting the potential rather than the limitations of Code
Agents for test generation.
7 Conclusion
We proposed SWT-B ENCH , a novel benchmark for test generation from GitHub issue descriptions
and the corresponding code bases. SWT-BENCH leverages the dataset underlying the popular SWE-
BENCH which additionally contains a golden patch fixing the described issue. We judge whether
a generated test reproduces the described issue by checking whether the test fails before applying
this golden patch and succeeds afterward. We measure both the rate of such fail-to-pass tests and
the coverage of the golden patch, providing a corresponding evaluation harness. We evaluated a
variety of LLM-based test generation methods including Code Agents on SWT-B ENCH and found
that Code Agents already outperform other approaches with only minor adaptations for the test-
generation task. Finally, we demonstrated the great potential of generated tests to serve as a signal for
the correctness of code fixes, with Code Agents achieving twice the precision when only proposing
fixes that cause a previously failing self-generated test to pass.
9

References
[1] John Yang, Carlos E. Jimenez, Alexander Wettig, Kilian Lieret, Shunyu Yao, Karthik
Narasimhan, and Ofir Press. Swe-agent: Agent computer interfaces enable software engi-
neering language models, 2024.
[2] Wei Tao, Yucheng Zhou, Wenqiang Zhang, and Yu Cheng. MAGIS: llm-based multi-agent
framework for github issue resolution. CoRR, abs/2403.17927, 2024.
[3] Yuntong Zhang, Haifeng Ruan, Zhiyu Fan, and Abhik Roychoudhury. Autocoderover: Au-
tonomous program improvement. CoRR, abs/2404.05427, 2024.
[4] Islem Bouzenia, Premkumar T. Devanbu, and Michael Pradel. Repairagent: An autonomous,
llm-based agent for program repair. CoRR, 2024.
[5] Opendevin: Code less, make more, 2024.
[6] Islem Bouzenia, Premkumar T. Devanbu, and Michael Pradel. Repairagent: An autonomous,
llm-based agent for program repair. CoRR, abs/2403.17134, 2024.
[7] Max Schäfer, Sarah Nadi, Aryaz Eghbali, and Frank Tip. An empirical evaluation of using
large language models for automated unit test generation. IEEE Trans. Software Eng., 50(1),
2024.
[8] Nadia Alshahwan, Jubin Chheda, Anastasia Finegenova, Beliz Gokkaya, Mark Harman, Inna
Harper, Alexandru Marginean, Shubho Sengupta, and Eddy Wang. Automated unit test im-
provement using large language models at meta. CoRR, abs/2402.09171, 2024.
[9] Stephan Lukasczyk and Gordon Fraser. Pynguin: Automated unit test generation for python.
In Proc. of ICSE, 2022.
[10] Michele Tufano, Dawn Drain, Alexey Svyatkovskiy, Shao Kun Deng, and Neel Sundaresan.
Unit test case generation with transformers. ArXiv preprint, abs/2009.05617, 2020.
[11] Tsz On Li, Wenxi Zong, Yibo Wang, Haoye Tian, Ying Wang, Shing-Chi Cheung, and Jeff
Kramer. Nuances are the key: Unlocking chatgpt to find failure-inducing tests with differential
prompting. In Proc. of ASE, 2023.
[12] Nadia Alshahwan, Jubin Chheda, Anastasia Finegenova, Beliz Gokkaya, Mark Harman, Inna
Harper, Alexandru Marginean, Shubho Sengupta, and Eddy Wang. Automated unit test im-
provement using large language models at meta. CoRR, abs/2402.09171, 2024.
[13] Sungmin Kang, Juyeon Yoon, and Shin Yoo. Large language models are few-shot testers:
Exploring llm-based general bug reproduction. In Proc. of ICSE, 2023.
[14] Sungmin Kang, Juyeon Yoon, and Shin Yoo. LLM-powered test case generation for detecting
tricky bugs. ArXiv preprint, abs/2404.10304, 2024.
[15] Yinghao Chen, Zehao Hu, Chen Zhi, Junxiao Han, Shuiguang Deng, and Jianwei Yin. Chatu-
nitest: A framework for llm-based test generation. arXiv e-prints, 2023.
[16] Carlos E Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press, and
Karthik Narasimhan. Swe-bench: Can language models resolve real-world github issues?
ArXiv preprint, abs/2310.06770, 2023.
[17] Mark Chen, Jerry Tworek, Heewoo Jun, Qiming Yuan, Henrique Pondé de Oliveira Pinto, Jared
Kaplan, Harrison Edwards, Yuri Burda, Nicholas Joseph, Greg Brockman, Alex Ray, Raul
Puri, Gretchen Krueger, Michael Petrov, Heidy Khlaaf, Girish Sastry, Pamela Mishkin, Brooke
Chan, Scott Gray, Nick Ryder, Mikhail Pavlov, Alethea Power, Lukasz Kaiser, Mohammad
Bavarian, Clemens Winter, Philippe Tillet, Felipe Petroski Such, Dave Cummings, Matthias
Plappert, Fotios Chantzis, Elizabeth Barnes, Ariel Herbert-V oss, William Hebgen Guss, Alex
Nichol, Alex Paino, Nikolas Tezak, Jie Tang, Igor Babuschkin, Suchir Balaji, Shantanu Jain,
William Saunders, Christopher Hesse, Andrew N. Carr, Jan Leike, Joshua Achiam, Vedant
Misra, Evan Morikawa, Alec Radford, Matthew Knight, Miles Brundage, Mira Murati, Katie
Mayer, Peter Welinder, Bob McGrew, Dario Amodei, Sam McCandlish, Ilya Sutskever, and
Wojciech Zaremba. Evaluating large language models trained on code. CoRR, 2021.
10

[18] Dan Hendrycks, Steven Basart, Saurav Kadavath, Mantas Mazeika, Akul Arora, Ethan Guo,
Collin Burns, Samir Puranik, Horace He, Dawn Song, and Jacob Steinhardt. Measuring coding
challenge competence with APPS. In NeurIPS Datasets and Benchmarks, 2021.
[19] Jacob Austin, Augustus Odena, Maxwell I. Nye, Maarten Bosma, Henryk Michalewski, David
Dohan, Ellen Jiang, Carrie J. Cai, Michael Terry, Quoc V . Le, and Charles Sutton. Program
synthesis with large language models. ArXiv preprint, abs/2108.07732, 2021.
[20] Derrick Lin, James Koppel, Angela Chen, and Armando Solar-Lezama. Quixbugs: a multi-
lingual program repair benchmark set based on the quixey challenge. In Proc. of SPLASH,
2017.
[21] Yujia Li, David Choi, Junyoung Chung, Nate Kushman, Julian Schrittwieser, Rémi Leblond,
Tom Eccles, James Keeling, Felix Gimeno, Agustin Dal Lago, Thomas Hubert, Peter Choy,
Cyprien de Masson d’Autume, Igor Babuschkin, Xinyun Chen, Po-Sen Huang, Johannes
Welbl, Sven Gowal, Alexey Cherepanov, James Molloy, Daniel J. Mankowitz, Esme Suther-
land Robson, Pushmeet Kohli, Nando de Freitas, Koray Kavukcuoglu, and Oriol Vinyals.
Competition-level code generation with alphacode. Science, 378(6624), 2022.
[22] Jiawei Liu, Chunqiu Steven Xia, Yuyao Wang, and Lingming Zhang. Is your code generated
by chatgpt really correct? rigorous evaluation of large language models for code generation.
In Proc. of NeurIPS, 2023.
[23] Tianyang Liu, Canwen Xu, and Julian J. McAuley. Repobench: Benchmarking repository-level
code auto-completion systems. CoRR, abs/2306.03091, 2023.
[24] Naman Jain, Manish Shetty, Tianjun Zhang, King Han, Koushik Sen, and Ion Stoica. R2e:
Turning any github repository into a programming agent test environment. In ICLR 2024,
2024.
[25] René Just, Darioush Jalali, and Michael D. Ernst. Defects4j: a database of existing faults to
enable controlled testing studies for java programs. In Proc. of ISSTA, 2014.
[26] Shuofei Qiao, Ningyu Zhang, Runnan Fang, Yujie Luo, Wangchunshu Zhou, Yuchen Eleanor
Jiang, Chengfei Lv, and Huajun Chen. AUTOACT: automatic agent learning from scratch via
self-planning. CoRR, abs/2401.05268, 2024.
[27] Qingyun Wu, Gagan Bansal, Jieyu Zhang, Yiran Wu, Shaokun Zhang, Erkang Zhu, Beibin Li,
Li Jiang, Xiaoyun Zhang, and Chi Wang. Autogen: Enabling next-gen LLM applications via
multi-agent conversation framework. CoRR, abs/2308.08155, 2023.
[28] Chen Qian, Xin Cong, Cheng Yang, Weize Chen, Yusheng Su, Juyuan Xu, Zhiyuan Liu, and
Maosong Sun. Communicative agents for software development. CoRR, abs/2307.07924,
2023.
[29] Weize Chen, Yusheng Su, Jingwei Zuo, Cheng Yang, Chenfei Yuan, Chen Qian, Chi-Min
Chan, Yujia Qin, Yaxi Lu, Ruobing Xie, Zhiyuan Liu, Maosong Sun, and Jie Zhou. Agentverse:
Facilitating multi-agent collaboration and exploring emergent behaviors in agents. CoRR,
abs/2308.10848, 2023.
[30] Sirui Hong, Xiawu Zheng, Jonathan Chen, Yuheng Cheng, Jinlin Wang, Ceyao Zhang, Zili
Wang, Steven Ka Shing Yau, Zijuan Lin, Liyang Zhou, et al. Metagpt: Meta programming for
multi-agent collaborative framework. ArXiv preprint, abs/2308.00352, 2023.
[31] Stephen E. Robertson and Hugo Zaragoza. The probabilistic relevance framework: BM25 and
beyond. Found. Trends Inf. Retr., 3(4), 2009.
[32] OpenAI. GPT-4 technical report. ArXiv preprint, abs/2303.08774, 2023.
[33] Anthropic. Introducing Claude, 2023.
[34] MistralAI Team. Cheaper, better, faster, stronger - continuing to push the frontier of ai and
making it accessible to all., 2024.
11

[35] TogetherAI. Together AI API, 2023.
[36] Ye Yang, Mei He, Mingshu Li, Qing Wang, and Barry W. Boehm. Phase distribution of soft-
ware development effort. In Proc. of ESEM, 2008.
12

A Formalization of Custom Prompt Format for Z ERO SHOT PLUS
We introduce a custom prompt format for language models to aid them with patch generation in the
zero-shot setting. The format is visualized in Fig. 8 similar to how it is provided to the language
model. A full example of applying the format on two files is part of the full prompt of Z ERO SHOT-
PLUS in Figs. 10 and 11.
A diff block must start and end with diff and end diff respectively. The first line inside the block
must specify an existing file for rewrites and may point to a new file in the case of insertion. Next,
the language model specifies whether it intends to rewrite an existing function or insert a new
function. If no exact match of the function name is found, we employ a fuzzy search using the line
number or EOF/BOF as an indicator for where to look for the existing functions. EOF and BOF are
particularly useful for inserting new functions. We note that diff blocks can be repeated an arbitrary
number of times.
B Full prompts
ZERO SHOT, Z ERO SHOT PLUS and L IBRO The full prompt for Z ERO SHOT is displayed in
Figs. 9 and 10. The full prompt for ZERO SHOT PLUS and LIBRO is displayed in Figs. 11 and 12. Ex-
cept for the way we include files, all lines are changed with respect to the setting in SWE-B ENCH .
This includes in particular the demonstration of the unified diff format on an example. In the setting
for Table 5 we add the lines highlighted in boldface.
SWE-A GENT and SWE-A GENT + The prompt for SWE-A GENT and SWE-A GENT + is shown
in Fig. 13. Changes with respect to the prompt of [16] are highlighted in boldface. The additional
changes for SWE-A GENT + are highlighted in green.
AUTO CODE ROVER The AUTO CODE ROVER [3] leverages a number of prompts that are provided
to the model in different phases of the code/test generation process. We adapt the key prompts and
display them in Fig. 14. Changes are highlighted in boldface. Further, we change every occurrence
of "bug location" in the original prompts to "relevant location". We further add a function to the ACI
that allows inserting code in new files and fetching the entire code (capped at the first 100 lines) of
any file.
C Licenses of used Code
We adapt code from the following projects in our work and include the respective licenses:
1. SWE-B ENCH [16]: MIT License
2. SWE-A GENT [1]: MIT License
3. A UTO CODE ROVER [3]: GNU General Public License
For all licenses of the repositories used in SWT-B ENCH , we refer to Jiminez et al. [16], which
contains a detailed list with licenses for each repository included.
Table 7: Cost of different LLMs running SWE-A GENT on SWT-B ENCH Lite in USD
Model GPT-4 Haiku Mixtral
Cost 290.71 10.28 67.90
Table 8: Cost of running different methods on SWT-B ENCH Lite using GPT-4 in USD
Method Z EROSHOT ZEROSHOTPLUS PASS@5 L IBRO AUTOCODEROVER SWE-AGENT
Cost 82.13 80.70 403.65 420.14 368.40 290.71
13

1 diff
2 < path or filename >
3 < "rewrite" or "insert" >
4 < line number / EOF / BOF >
5 < function to rewrite or insert >
6 end diff
7 < repeat as necessary >
Figure 8: The Custom Diff format for ZERO SHOT PLUS
D Computational cost
There is cost to both running inference on Language Models and on evaluation their predictions
on the test suites of the repositories. Since the evaluation can be performed on a consumer grade
machine in reasonable time, we focus on the cost inferred from LLM inference. We report the cost
for each setting in Tables 7 and 8, displaying the average cost of a full inference on SWT-B ENCH
Lite for each model and method. The difference between cost of P ASS @5 and L IBRO is just the
additional filtering step incurred by LIBRO . We note that there is actually no additional cost incurred
from calling both PASS @5 and L IBRO , since the examples can be re-used in both approaches.
14

1 The following text contains a user issue (in <issue/> brackets) posted at a repository.
Further, you are provided with file contents of several files in the repository that
contain relevant code (in <code> brackets). It may be necessary to use code from
third party dependencies or files not contained in the attached documents however.
Your task is to identify the issue and implement a test case that verifies a
proposed solution to this issue. More details at the end of this text.
2
3 <issue>
4 user issue comes here
5 </issue>
6
7 retrieval results or oracle files come here
8
9 Please generate test cases that check whether an implemented solution
10 resolves the issue of the user (at the top, within <issue/> brackets).
11 Present the test cases in unified diff formatting.
12
13 The general format of a diff is the unified output format, described as follows.
14 The unified output format starts with a two-line header, which looks like this:
15
16 --- from-file
17 +++ to-file
18
19 Next come one or more hunks of differences; each hunk shows one area where the files
differ. Unified format hunks look like this:
20
21 @@ from-file-line-numbers to-file-line-numbers @@
22 line-from-either-file
23 line-from-either-file
24
25 If a hunk contains just one line, only its start line number appears. Otherwise its line
numbers look like 'start,count'. An empty hunk is considered to start at the line
that follows the hunk.
26
27 If a hunk and its context contain two or more lines, its line numbers look like 'start,
count'. Otherwise only its end line number appears. An empty hunk is considered to
end at the line that precedes the hunk.
28
29 The lines common to both files begin with a space character. The lines that actually
differ between the two files have one of the following indicator characters in the
left print column:
30
31 '+' A line was added here to the first file.
32 '-' A line was removed here from the first file.
33
34 Insertion can only be done at the end or beginning of the file, indicated by EOF or BOF
respectively.
35
36 As an example for a diff, consider the following two versions of the same file, once
before and once after a change.
37 The original version of the file was as follows.
38 [start of demo/test_file.py]
39 1 def test_euclidean(a, b):
40 2 assert euclidean(0, 0) == 0
41 3 assert euclidean(0, 1) == 1
42 4 assert euclidean(1, 0) == 1
43 5 assert euclidean(1, 1) == 1
44 6
45 7 @pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 1)
])
46 8 def test_gcd(a, b):
47 9 assert gcd(a, b) == expected
48 10
49 [end of demo/file.py]
Figure 9: Part 1 of the Prompt for ZERO SHOT on SWT-B ENCH
15

1
2 The diff for fix in function euclidean and adds the function gcd is as follows.
3 This diff changes the first file into the second file.
4 ```diff
5 --- a/demo/file.py
6 +++ a/demo/file.py
7 @@ -4,4 +4,5 @@
8 assert euclidean(1, 0) == 1
9 assert euclidean(1, 1) == 1
10 + assert euclidean(100, 10) == 10
11
12 @pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 1)
])
13 @@ -9,2 +10,6 @@
14 assert gcd(a, b) == expected
15
16 +@pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 1),
(100, 10, 10)])
17 +def test_lcm(a, b):
18 + assert lcm(a, b) == expected
19 +
20 ```
21
22 The new version of the file is as follows.
23 [start of demo/file.py]
24 1 def test_euclidean(a, b):
25 2 assert euclidean(0, 0) == 0
26 3 assert euclidean(0, 1) == 1
27 4 assert euclidean(1, 0) == 1
28 5 assert euclidean(1, 1) == 1
29 6 assert euclidean(100, 10) == 10
30 7
31 8 @pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 1)
])
32 9 def test_gcd(a, b):
33 10 assert gcd(a, b) == expected
34 11
35 12 @pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1,
1), (100, 10, 10)])
36 13 def test_lcm(a, b):
37 14 assert lcm(a, b) == expected
38 15
39 [end of demo/file.py]
40
41 As you can see, you need to indicate the approximate line numbers, function name and the
path and file name you want to change,
42 but there can be as many independent blocks of changes as you need. You may also apply
changes to several files.
43 Apply as much reasoning as you please and see necessary. The format of the solution is
fixed and has to follow the custom diff format.
44 Make sure to implement only test cases and don't try to fix the issue itself.
Figure 10: Part 2 of the Prompt for ZERO SHOT on SWT-B ENCH
16

1 The following text contains a user issue (in <issue/> brackets) posted at a repository.
Further, you are provided with file contents of several files in the repository that
contain relevant code (in <code> brackets). It may be necessary to use code from
third party dependencies or files not contained in the attached documents however.
Your task is to identify the issue and implement a test case that verifies a
proposed solution to this issue. More details at the end of this text.
2
3 <issue>
4 user issue comes here
5 </issue>
6
7 The following patch has been proposed to fix the issue described in the user issue (in
<issue/> brackets).The patch might give you a hint on how to write a covering test
for the issue, but you should not assume that the patch is correct.It might be that
the provided patch is not correct, so your test should check whether the patch
resolves the issue.<patch>proposed patch</patch>
8
9 retrieval results or oracle files come here
10
11 Please generate test cases that check whether an implemented solution
12 resolves the issue of the user (at the top, within <issue/> brackets).
13 Present the test cases as a diff (custom format, explained below).
14
15 The general format of a diff is as follows.
16 ```custom-diff
17 diff
18 <path/filename>
19 < "rewrite" or "insert" >
20 < rough line number / EOF / BOF >
21 < insert function that should be added or rewritten >
22 end diff
23 < repeat blocks of diff as necessary >
24 ```
25 Insertion can only be done at the end or beginning of the file, indicated by EOF or BOF
respectively.
26
27 As an example for a diff, consider the following two versions of the same file, once
before and once after a change.
28 The original version of the file was as follows.
29 [start of demo/test_file.py]
30 1 def test_euclidean(a, b):
31 2 assert euclidean(0, 0) == 0
32 3 assert euclidean(0, 1) == 1
33 4 assert euclidean(1, 0) == 1
34 5 assert euclidean(1, 1) == 1
35 6
36 7 @pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 1)
])
37 8 def test_gcd(a, b):
38 9 assert gcd(a, b) == expected
39 10
40 [end of demo/file.py]
41 ```
Figure 11: Part 1 of the Prompt for ZERO SHOT PLUS on SWT-B ENCH
17

1 The diff for fix in function euclidean and adds the function gcd is as follows.
2 This diff changes the first file into the second file.
3 ```custom-diff
4 diff
5 demo/file.py
6 rewrite
7 1
8 def test_euclidean(a, b):
9 assert euclidean(0, 0) == 0
10 assert euclidean(0, 1) == 1
11 assert euclidean(1, 0) == 1
12 assert euclidean(1, 1) == 1
13 assert euclidean(100, 10) == 10
14 end diff
15 diff
16 demo/file.py
17 insert
18 EOF
19 @ pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 1),
(100, 10, 10)])
20 def test_lcm(a, b):
21 assert lcm(a, b) == expected
22 end diff
23
24 The new version of the file is as follows.
25 [start of demo/file.py]
26 1 def test_euclidean(a, b):
27 2 assert euclidean(0, 0) == 0
28 3 assert euclidean(0, 1) == 1
29 4 assert euclidean(1, 0) == 1
30 5 assert euclidean(1, 1) == 1
31 6 assert euclidean(100, 10) == 10
32 7
33 8 @pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 1)
])
34 9 def test_gcd(a, b):
35 10 assert gcd(a, b) == expected
36 11
37 12 @pytest.mark.parametrize("a, b, expected", [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1,
1), (100, 10, 10)])
38 13 def test_lcm(a, b):
39 14 assert lcm(a, b) == expected
40 15
41 [end of demo/file.py]
42
43 As you can see, you need to indicate the approximate line numbers, function name and the
path and file name you want to change,
44 but there can be as many independent blocks of changes as you need. You may also apply
changes to several files.
45 Apply as much reasoning as you please and see necessary. The format of the solution is
fixed and has to follow the custom diff format.
46 Make sure to implement only test cases and don't try to fix the issue itself.
Figure 12: Part 2 of the Prompt for ZERO SHOT PLUS on SWT-B ENCH
18

1 We have received following issue within our repository. Here's the issue text:
2 ISSUE:
3 {issue}
4
5 INSTRUCTIONS:
6 Now, you’re going to create unit tests that cover the issue. In other words, you should
write unit tests that fail in the current state of the repositorybut will pass when
the issue has been resolved. Essentially, you’ll want to write a unit test that
reproduces the described issue.
7 Your terminal session has started and you're in the repository's root directory. You can
use any bash commands or the special interface to help you. Edit all the files you
need to and run any checks or tests that you want.
8 Remember, YOU CAN ONLY ENTER ONE COMMAND AT A TIME. You should always wait for feedback
after every command.
9 When you're satisfied with all of the changes you've made, you can submit your changes
to the code base by simply running the submit command.
10 Note however that you cannot use any interactive session commands (e.g. python, vim) in
this environment, but you can write scripts and run them. E.g. you can write a
python script and then run it with `python <script_name>.py`.
11
12 NOTE ABOUT THE EDIT COMMAND: Indentation really matters! When editing a file, make sure
to insert appropriate indentation before each line!
13
14 IMPORTANT TIPS:
15 1. Always start by trying to replicate the bug that the issues discusses.
16 If the issue includes code for reproducing the bug, we recommend that you re-
implement that in your environment, and run it to make sure you can reproduce
the bug.
17 Then start trying to fix it.
18 When you think you've fixed the bug, re-run the bug reproduction script to make sure
that the bug has indeed been fixed.
19
20 If the bug reproduction script does not print anything when it successfully runs, we
recommend adding a print("Script completed successfully, no errors.") command
at the end of the file,
21 so that you can be sure that the script indeed ran fine all the way through.
22
23 2. If you run a command and it doesn't work, try running a different command. A command
that did not work once will not work the second time unless you modify it!
24
25 3. If you open a file and need to get to an area around a specific line that is not in
the first 100 lines, say line 583, don't just use the scroll_down command multiple
times. Instead, use the goto 583 command. It's much quicker.
26
27 4. If the bug reproduction script requires inputting/reading a specific file, such as
buggy-input.png, and you'd like to understand how to input that file, conduct a
search in the existing repo code, to see whether someone else has already done that.
Do this by running the command: find_file "buggy-input.png" If that doesn't work,
use the linux 'find' command.
28
29 5. Always make sure to look at the currently open file and the current working directory
(which appears right after the currently open file). The currently open file might
be in a different directory than the working directory! Note that some commands,
such as 'create', open files, so they might change the current open file.
30
31 6. When editing files, it is easy to accidentally specify a wrong line number or to
write code with incorrect indentation. Always check the code after you issue an edit
to make sure that it reflects what you wanted to accomplish. If it didn't, issue
another command to fix it.
32
33 7. After having applied your changes and before submitting, make sure to run pytest and
check if the code *fails* as expected due to the issue description. If it doesn’t,
revisit your code changes and adapt them accordingly.
Figure 13: The Prompt for SWE-A GENT on SWT-B ENCH
19

1 You are a software developer maintaining a large project.
2 You are working on an issue submitted to your project.
3 The issue contains a description marked between <issue> and </issue>.
4 Your task is to invoke a few search API calls to gather information about relevant code
lines, then write unit tests to capture the described behaviour in the
issue.Ideally, the unit tests should fail before the bug is fixed or the requested
feature is added, and pass after.Note you are not trying to solve the bug itself,
but just capture the behaviour described in the issue by creating appropriate testcases.
1 You are a software developer maintaining a large project.
2 You are working on an issue submitted to your project.
3 The issue contains a description marked between <issue> and </issue>.
4 You ultimate goal is to write one or more unit tests that capture this issue.Ideally,
the unit tests should fail before the bug is fixed or the requested feature is
added, and pass after.Note you are not trying to solve the bug itself, but just
capture the behaviour described in the issue by creating appropriate test cases.
1 Write one or more unit tests for the issue, based on the retrieved context.
2
3 You can import necessary libraries.
4
5
6 Return the tests as patch in the format below.
7
8 Within `<file></file>`, replace `...` with actual file path.
9
10 Within `<original></original>`, replace `...` with the original code snippet from the
program.
11
12 Within `<patched></patched>`, replace `...` with the fixed version of the original code.
When adding orignal code and updated code, pay attention to indentation, as the
code is in Python.
13 You can write multiple modifications if needed.
14
15 ```
16 # modification 1
17 <file>...</file>
18 <original>...</original>
19 <patched>...</patched>
20
21 # modification 2
22 <file>...</file>
23 <original>...</original>
24 <patched>...</patched>
25
26 # modification 3
27 ...
28 ```
Figure 14: The Prompt for AUTO CODE ROVER on SWT-B ENCH
20