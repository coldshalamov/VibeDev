---

Title: How to Understand Whole Software Repository?

---


How to Understand Whole Software Repository?
Yingwei Ma, Qingping Yang, Rongyu Cao, Binhua Li, Fei Huang, Yongbin Li∗
{mayingwei.myw,yangqingping.yqp,caorongyu.cry,binhua.lbh,f.huang,shuide.lyb}@alibaba-inc.com
Alibaba Group
ABSTRACT
Recently, Large Language Model (LLM) based agents have advanced
the significant development of Automatic Software Engineering
(ASE). Although verified effectiveness, the designs of the existing
methods mainly focus on the local information of codes, e.g., is-
sues, classes, and functions, leading to limitations in capturing the
global context and interdependencies within the software system.
From the practical experiences of the human SE developers, we
argue that an excellent understanding of the whole repository will
be the critical path to ASE. However, understanding the whole
repository raises various challenges, e.g., the extremely long code
input, the noisy code information, the complex dependency rela-
tionships, etc. To this end, we develop a novel ASE method named
RepoUnderstander by guiding agents to comprehensively under-
stand the whole repositories. Specifically, we first condense the
critical information of the whole repository into the repository
knowledge graph in a top-to-down mode to decrease the complex-
ity of repository. Subsequently, we empower the agents the ability
of understanding whole repository by proposing a Monte Carlo
tree search based repository exploration strategy. In addition, to
better utilize the repository-level knowledge, we guide the agents to
summarize, analyze, and plan. Then, they can manipulate the tools
to dynamically acquire information and generate the patches to
solve the real-world GitHub issues. Extensive experiments demon-
strate the superiority and effectiveness of the proposed RepoUnder-
stander. It achieved 18.5% relative improvement on the SWE-bench
Lite benchmark compared to SWE-agent.
CCS CONCEPTS
• Software and its engineering →Automatic programming; •
Computing methodologies →Multi-agent planning.
KEYWORDS
Automatic Software Engineering (ASE), Agents, Large Language
Models (LLMs), Fault Localization, Program Repair, Monte Carlo
Tree Search (MCTS)
ACM Reference Format:
Yingwei Ma, Qingping Yang, Rongyu Cao, Binhua Li, Fei Huang, Yongbin
Li. 2018. How to Understand Whole Software Repository?. In Proceedings of
∗Corresponding author.
Permission to make digital or hard copies of all or part of this work for personal or
classroom use is granted without fee provided that copies are not made or distributed
for profit or commercial advantage and that copies bear this notice and the full citation
on the first page. Copyrights for components of this work owned by others than the
author(s) must be honored. Abstracting with credit is permitted. To copy otherwise, or
republish, to post on servers or to redistribute to lists, requires prior specific permission
and/or a fee. Request permissions from permissions@acm.org.
Conference acronym ’XX, June 03–05, 2018, Woodstock, NY
© 2018 Copyright held by the owner/author(s). Publication rights licensed to ACM.
ACM ISBN 978-1-4503-XXXX-X/18/06. . . $15.00
https://doi.org/XXXXXXX.XXXXXXX
Make sure to enter the correct conference title from your rights confirmation
emai (Conference acronym ’XX). ACM, New York, NY, USA, 13 pages. https:
//doi.org/XXXXXXX.XXXXXXX
1 INTRODUCTION
Automating Software Engineering (ASE), which aims to automati-
cally accomplish the Software Engineering (SE) tasks, is a promis-
ing and challenging research direction. Recent years, in the ASE
domain, Large Language Models (LLMs), especially LLM-based
agents, have demonstrated their strong general abilities, e.g., the
environment awareness ability [15, 21, 37], planning & reasoning
ability [6, 29, 32, 37], tool construction [48] ability, etc.
More recently, an exemplary milestone termed Devin [ 6] ex-
plores an end-to-end LLM-based agent system for complex real-
world SE tasks (i.e., fix real-world Github issues). Specifically, it
plans user requirements, utilizes editor, terminal, and search en-
gine tools for independent decision-making and reasoning, and
eventually generates code patches to meet the needs. This inno-
vative approach has garnered considerable attention from the AI
and SE communities, notably sparking interest in ASE [43, 49]. For
instance, SWE-agent [43] strategically designs an Agent Computer
Interface (ACI) to empower SE agents in creating & editing code
files, navigating repositories, and executing programs. Additionally,
AutoCodeRover [49] extracts abstract syntax trees in programs,
iteratively searches for useful information based on requirements,
and generates program patches.
Although the pioneers highlighted the road to advanced ASE
and achieved promising performance, their designs, focusing on
local information, failed to grasp the global context and intricate
interdependencies among functions and classes. For example, SWE-
agent [43] maintains a context window within a code file that allows
the agent to scroll up and down. AutoCodeRover [ 49] searches
functions or classes within the whole repository. Typically, the
code comprising a full logic chain for a specific functionality is
not arranged sequentially within a single file; rather, it is logically
scattered across multiple folders and files. It is difficult to retrieve all
relevant code files among maybe thousands of files in a repository,
especially starting only from the text in user requirements. This
paper argues that a comprehensive understanding of the whole
repository becomes the most critical path to ASE.
Undoubtedly, it is challenging to utilize the vast information
of an entire repository within LLM. Firstly, a GitHub repository
may contain thousands of code files, making it impractical to in-
clude them all in the context windows of LLM. Even if it could, an
LLM would struggle to accurately capture the code relevant to the
objective within such an extensive context. Secondly, since user re-
quirements are often described in natural language, identifying the
relevant code within a repository presents a significant challenge.
Thirdly, the intrinsic logic of how the code execution is distinctly
different from the sequence of the code text in a file. For instance,
arXiv:2406.01422v1  [cs.SE]  3 Jun 2024

Conference acronym ’XX, June 03–05, 2018, Woodstock, NY Trovato et al.
the location where a bug triggers an error message and the actual
place that requires modification may not be in the same file, yet
they are certainly logically connected.
To solve this problem, we propose a novel ASE method named
RepoUnderstander by guiding the LLM-based agents to compre-
hensively understand the whole repository and take advantage of
the learned the repository-level knowledge. Imaging the human
software engineers are solving project-level issues, they will first
overview the repository to ensure a full understanding of the func-
tional modules and dependencies that may be involved. Motivated
by this practical insight, we first condense the complex repository-
level information by constructing the repository knowledge graph
in a top-down manner. Concretely, the repository is organized into
a hierarchical structure tree, enabling a clear understanding of
the code’s context and scope. Besides, to facilitate comprehensive
dependency and interaction analysis, the tree structure is further
expanded into a reference graph that captures function call rela-
tionships.
Subsequently, we propose a Monte Carlo Tree Search (MCTS)
based repository exploration strategy to empower the LLM-based
agents the ability of collecting and learning repository-level knowl-
edge. Specifically, the agents first collect the critical information
regarding to the SE task on the repository knowledge graph by the
explore-and-exploit strategy. Then, by simulating multiple trajec-
tories and evaluating their reward score, our method iteratively
narrows down the search space and guide the agents to focus on
the most relevant areas. In addition, to better utilize the repository-
level knowledge, we guide the agents to summarize, analyze, and
plan for the repository information regarding to the SE targets. By
these designs, it enables the agents to effectively and efficiently col-
lect and learn task-relevant repository-level knowledge, therefore
facilitating the precise fault localization and the informed patch
generation. Finally, the agents are instructed to manipulate the
API tools to dynamically acquire local information, and fix the real-
world issues by generating patches. We demonstrate the superiority
and effectiveness of RepoUnderstander via extensive experiments
and comprehensive analyses. Besides, through carefully analyses
during the experiments, we identify an important problem of the
SWE-bench dataset, i.e., missing the necessary interface specifica-
tion for new feature issues. We propose to fix it and achieve more
reliable and effective evaluation for our method and the baseline.
The main contributions of this paper are summarized as follows.
•We highlight the whole repository understanding as the
crucial path to ASE and propose a novel agent-based method
named RepoUnderstander to solve the challenges.
•We propose to condense the extensive codes and complex
relations of the repository into the knowledge graph in a
top-to-down mode, improving performance and efficiency.
•We design a Monte Carlo tree search based repository explo-
ration strategy to assist the comprehensive understanding
of the whole repository for the issue-solving agents.
•Extensive experiments and analyses demonstrate the superi-
ority and effectiveness of RepoUnderstander 1.
1https://github.com/RepoUnderstander/RepoUnderstander
2 RELATED WORK
2.1 LLM-based Software Engineering Agents
In recent years, Large Language Model (LLM) based AI agents have
advanced the development of automatic software engineering. AI
agents improve the capabilities of project-level software engineer-
ing (SE) tasks through running environment awareness [15, 21, 37],
planning & reasoning [6, 29, 32, 37], and tool construction [23, 48].
Surprisingly, Devin [6] is a milestone that explores an end-to-end
LLM-based agent system to handle complex SE tasks. Concretely,
it first plans the requirements of users, then adopts the editor, ter-
minal and search engine tools to make independent decisions and
reasoning, and finally generates codes to satisfy the needs of users
in an end-to-end manner. Its promising designs and performance
swiftly ignited unprecedented attention from the AI community and
SE community to Automatic Software Engineering (ASE) [43, 49].
For example, SWE-agent [43] carefully designs an Agent Computer
Interface (ACI) to empower the SE agents capabilities of creating &
editing code files, navigating repositories, and executing programs.
Besides, AutoCodeRover [49] extracts the abstract syntax trees in
programs, then iteratively searches the useful information accord-
ing to requirements, and eventually generates program patches.
Their designs mainly focus on the local information in the repos-
itory, e.g., code files, classes, or functions themselves. Although
achieving promising performance, from the insights of the human
SE developers, the excellent understanding of the whole repository
is a critical path to ASE.
2.2 Evaluation of LLM-based Software
Engineering Agents
Benefiting from the strong general capability of LLMs, LLM-based
software engineering agents can handle many important SE tasks,
e.g., repository navigation [37, 48], code generation [8, 15, 18, 34,
36], debugging [15, 43, 49], program repair [33, 43, 49]. The exist-
ing methods usually regard code generation as a core ability and
mainly conduct evaluations on it. Precisely, the code generation
test set [2, 5, 25, 28, 50] consists of the short problem description,
the solution, and the corresponding unit test data. However, with
the fast development of LLMs and agents, these datasets are no
longer able to comprehensively evaluate their capabilities in the
real-world SE tasks. To this end, the repository-level code comple-
tion and generation tasks [9, 12, 26] are presented to evaluate the
repository understanding and generation capabilities of LLMs and
agents. More recently, SWE team[19, 43] develop a unified dataset
named SWE-bench to evaluate the capability of the agent system to
solve real-world GitHub issues automatically. Specifically, it collects
the task instances from real-world GitHub issues from twelve repos-
itories. Consistent with previous evaluation methods, SWE-bench
is based on the automatic execution of the unit tests. Differently,
the presented test set is challenging and requires the agents to have
multiple capabilities, including repository navigation, fault locat-
ing, debugging, code generation and program repairing. Besides,
SWE-bench Lite [4] is a subset of SWE-bench, and it has a similar
diversity and distribution of repositories as the original version.
Due to the smaller test cost and more detailed filtering, SWE-bench
Lite is officially recommended as the benchmark of LLM-based SE

How to Understand Whole Software Repository? Conference acronym ’XX, June 03–05, 2018, Woodstock, NY
agents. Therefore, consistent with previous methods [32, 43, 49],
we report our performance on SWE-bench Lite.
2.3 Repository-level Code Intelligence
With the development of AI technology, the field of code intelli-
gence has gradually transitioned from solving single function-level
or code snippet-level problems to real-world software development
at the repository level. In the repository-level code intelligence
task, there are many works [3, 10, 13, 24, 27, 35, 45, 47] that aim to
leverage the large amount of code available in current repositories
to help code models generate better, more accurate code. Among
them, StarCoder2 [27] and Deepseek-Coder [13] model repository
knowledge in the pre-training stage, sort repository files accord-
ing to reference dependencies, and guide the model to learn the
global dependencies of repository information. RepoCoder [ 47]
continuously retrieves relevant content by iterating RAG, while
methods such as CoCoMIC [10] and RepoFuse [24] jointly use the
RAG module and the current file’s dependency relationship module
to introduce it into the context of LLM. Although the above meth-
ods enhance the model’s understanding of the repository context
to a certain extent, the repository-level code often contains com-
plex contextual call relationships, and the RAG method alone may
not be able to recall all semantically relevant content. In addition,
there may be a large amount of complex irrelevant information
in the RAG results, which interferes with the model’s accurate
fault location. Therefore, starting from the practical experience of
software engineering, we simulated people’s global experience in
understanding the repository and experience-guided exploration
and location to achieve more effective repository understanding.
3 METHODOLOGY
3.1 Overview
We first describe the overall operating process of RepoUnderstander,
and introduce the stages in detail in the subsequent parts of this
section. Given a workspace, RepoUnderstander can automatically
solve real-world GitHub issues. Among them, RepoUnderstander
involves three key steps, repository knowledge graph construction
stage, MCTS-enhanced repository understanding stage, information
utilization & patch generation stage. The overall workflow is shown
in Figure 1.
In Repository Knowledge Graph Construction phase, Re-
poUnderstander first builds a repository knowledge graph to repre-
sent the entire repository and describe the relationships between
entities. This is achieved by parsing the software structure and an-
alyzing it in a top-down manner. The repository is first organized
into a hierarchical tree that allows a clear understanding of the con-
text and scope of the code. To facilitate comprehensive dependency
and interaction analysis, the tree structure is further extended into
a reference graph that captures function call relationships.
Due to the large scale and information complexity of the reposi-
tory knowledge graph, during the MCTS-Enhanced Repository
Understanding phase, RepoUnderstander uses the Monte Carlo
tree search algorithm to dynamically explore the entire graph. This
method focus on discovering key information (i.e., repository func-
tionality and dependency structure) that has a significant impact
on issue solving. Through correlation expansion and reference ex-
pansion, MCTS simulates multiple trajectories and evaluates their
importance, dynamically narrowing the search space and allocating
computing resources to the most relevant regions. This targeted
navigation enables the model to efficiently access and process im-
portant information in the repository, thereby facilitating precise
fault localization and informed patch generation.
Inspired by the actual development experience of human pro-
grammers, it is necessary to have certain global prior knowledge
of the repository before solving specific tasks. Therefore, in In-
formation Utilization & Patch Generation phase, RepoUnder-
stander first summarizes the important information collected in the
repository understanding phase to form an experience of the entire
repository. Then, in order for RepoUnderstander to use the global
experience to obtain dynamic information during the problem solv-
ing process, we follow AutoCodeRover[49]’s information retrieval
method and use API tools to extract information in the repository
knowledge graph. This includes specific classes and functions and
code snippets, etc., to maintain local dynamic knowledge during
the task. After collecting enough context, RepoUnderstander uses
global experience to summarize the currently acquired information
to locate faults, generate modified code and return patches that try
to resolve the issue.
3.2 Repository Knowledge Graph Construction
For human programmers, when solving project-level issues, devel-
opers first need to carefully review and understand the project’s
software repository to ensure that they have a full understanding
of the functional modules and dependencies that may be involved.
This includes building the hierarchical tree structure and call graph
of the software repository. Through the hierarchical tree structure,
developers can clearly see the overall architecture of the project and
the relationship between each module; through the call graph, de-
velopers can understand the calling relationships and dependency
paths between functions to identify the root causes of problems
and the potential impact of changes.
Therefore, in order to learn from the practices of human pro-
grammers in understanding and maintaining code, we represent
the entire repository as a repository knowledge graph and describe
the relationships between entities by parsing the software struc-
ture (see Repo. Knowledge Graph Construction in Figure 1). First,
we top-down analyze the structure of the software repository, or-
ganizing the repository into a hierarchical structure tree (including
files, classes, and functions) to clearly understand the context and
scope of the code. We then extend the tree structure into a reference
graph containing function call relationships, allowing the model
to perform comprehensive dependency and interaction analysis.
Different from existing methods[10, 29], our reference relationship
only involves functions, because functions are the basic unit of
program execution, and the calling relationship between functions
directly affects the behavior and execution logic of the program.
Excessive reference relationships may increase the complexity of
the graph structure and affect the analysis efficiency and accu-
racy of the model. This structured repository knowledge graph not
only improves the efficiency of the model in retrieving relevant

Conference acronym ’XX, June 03–05, 2018, Woodstock, NY Trovato et al.
Repo. Knowledge Graph Construction MCTS-Enhanced Repo. Understanding Info. Summary & Patch Generation
Issue: Enable quiet mode/no-verbose in CLI for use in pre-commit hook. There seems to be only 
an option to increase the level of verbosity when using SQLFluff, not to limit it further... 
Codebase
util.py
src/sqlfluff/cli/ commands.py
examples/ api_usage.py
setup.py
Repository
 1 4
3
Selection Backprop. & Ref. Expansion 
Corr. Expansion 
 Simulation & Eval
2
Correlation
 Expansion 
Reference
 Expansion 
Repo. Summary
Dynamic info. acquisition
Patch Generation
Top1 path:
Top2 path:
Topk path:
Analyze Result:
Top1 path: It's responsible for handling the xxx 
Top2 path:This function handles the xxx.
Topk path: There is a check for xxx. 
Plan:
Checking the xxx and Verifying that xx.
1. search_class (cls)
2. search_method (m)
3. search_code (c)
4. ...
1. Buggy location is: func A
3. Get patch: diff
2. Code generation
Balances the 
exploration-exploitation 
Reward Reward score: 9
Reward score: 9
Structural 
Dependency
Reference 
Dependency
Repository/
 File/
 Class/
 function/ Backprop. Simultation
 LLM-based 
Agent
def set_logging_level
class RedWarningsFilter
code snippet 2
code snippet 1
Figure 1: The overview of our proposed RepoUnderstander. Firstly, we construct the repository knowledge graph is constructed
to efficiently represent the code and the dependency in the repository. Subsequently, we empower the agents with the ability of
repository understanding by designing the Monte Carlo tree search based repository explore strategy. In addition, we guide the
agents to summarize, analyze, and plan to better utilize the repository-level knowledge. Then, they can manipulate the tools to
dynamically acquire issue-relevant code information and generate the patches to solve the real-world GitHub issues
information, but also ensures the consistency and reliability of the
automated process.
Specifically, we recursively traverse each code file in the repos-
itory, use abstract syntax trees to parse the corresponding files
respectively, and obtain basic units such as classes and functions,
including their names, code snippets, paths, and locations in the
files. We then add these elements to the structure tree from top
to bottom. Finally, we analyze the calling relationship between
functions and add corresponding directed edges to the graph. This
in-depth understanding provides LLM agents with the necessary
background knowledge and contextual information, allowing them
to more accurately locate the problem and come up with effective
solutions.
3.3 MCTS-Enhanced Repository Understanding
After building a repository knowledge graph, a comprehensive
understanding of the information in the graph is critical to effec-
tively solving problems. However, given the complexity and size of
modern software systems, often containing hundreds of files and
thousands of functions. The vast magnitude of the search space
in large software repositories makes exhaustive analysis imprac-
tical. Furthermore, context length limitations of language models
limit the amount of information that can be efficiently processed at
given conversation. Therefore, without targeted methods to identify
highly relevant nodes and edges in graphs, models may struggle to
perform accurate and efficient analysis, hampering their ability to
solve real-world software engineering problems.
To address these challenges, we propose an repository explo-
ration approach that leverages Monte Carlo Tree Search (MCTS)
to enhance LLM and agents’ understanding of software reposito-
ries (see MCTS-Enhanced Repo. Understanding in Figure 1). This
method systematically explores the repository knowledge graph
and prioritizes the discovery of critical information such as reposi-
tory functions and dependency structures that have a greater impact
on resolving issues. By simulating multiple trajectories and evaluat-
ing their importance, MCTS dynamically narrows the search space
and focuses computational resources on the most relevant areas.
This targeted navigation enables models to access and process im-
portant information more efficiently, thus facilitating precise fault
localization and informed patch generation. The MCTS process
begins from a root node, representing the repository node, and
unfolds in four iterative stages: selection, correlation expansion,
simulation&evaluation and backpropagation&reference expansion.
Below we describe each stage in further detail.
Selection. The selection phase aims to balance exploration and
exploitation problems in the node selection process. The main chal-
lenge in this phase is to maintain a balance between in-depth anal-
ysis of highly relevant content in the repository and a broad search

How to Understand Whole Software Repository? Conference acronym ’XX, June 03–05, 2018, Woodstock, NY
for potentially important information throughout the repository.
Delving excessively into high-correlation modules can cause the
model within a local optimal solution, ignoring that other critical
paths or dependencies may exist. Extensive search may lead to the
dispersion of computing resources and the processing of a large
amount of irrelevant information, which increases the burden on
the model and reduces search efficiency. To balance the needs of
the above two aspects, we use the UCT algorithm [ 20] for node
selection, following the formula:𝑈𝐶𝑇 = 𝑤𝑖
𝑛𝑖 +𝑐
√︃
2 ln𝑛𝑝
𝑛𝑖 , where𝑤𝑖 is
the total reward of child node 𝑖. The calculation of specific rewards
will be introduced in detail in Simulation & Evaluation section. 𝑛𝑖
is the number of visits to child node𝑖and 𝑛𝑝 is the number of visits
to the parent node. 𝑐 is the exploration parameter used to adjust
the balance between exploration and exploitation. In this work, we
set 𝑐 to
√
2/2.
Correlation Expansion. During the expansion process, leaf
nodes are expanded to incorporate new nodes. If the current leaf
node has a child node in the repository knowledge graph, the most
likely child node is selected instead of random expansion. In this
stage, we designed two methods: Correlation expansion and Refer-
ence relationship expansion. In this section, we mainly introduce
correlation expansion, and reference relationship expansion will be
introduced in the Backpropagation & Reference Expansion section.
Similar code is most likely to be code related to user requirements.
User requirements or issues usually contain some keywords that
may add new or modified functions. Therefore, we use the bm25
score to calculate the relevance [ 9, 17, 42], and give priority to
codes with higher relevance for expansion. Correlation expansion
can effectively match user requirements with relevant nodes in the
software knowledge graph, thereby improving the accuracy and
efficiency of node expansion.
Simulation & Evaluation. After completing the expansion,
we enter the simulation process. During the simulation, we start
from the newly expanded node and simulate along possible paths to
evaluate the effectiveness of these paths in solving the current issue.
Consistent with the correlation expansion method, we continuously
and recursively select the child nodes with the highest correlation
scores in the software knowledge graph until leaf nodes, and then
reward the nodes.
In the evaluation phase, we need to evaluate the relevance of
the selected leaf nodes to the issue, including classes, top-level
functions, class methods or sub-functions, etc. However, traditional
evaluation methods usually rely on keyword matching and semantic
matching algorithms, which perform poorly when dealing with
complex software systems and diverse problem descriptions.
Inspired by the success of large language models in in-context
learning (ICL) [11, 40] and Chain-of-Thought (CoT) [38] methods,
we propose a reward method based on ICL and CoT, aiming to pro-
vide a more accurate and reliable solution for relevance evaluation
in software repository. Our approach leverages the advanced ability
of large language models to learn and optimize reward functions
from limited examples of programming practice to accurately as-
sess the correlation between leaf nodes and problem descriptions.
Specifically, we first use ICL to let the language model learn to
understand the core functions and operating modes of the reward
function in a given context. Then, the CoT is used to enable the
You are a programming assistant who helps users solve issue 
regarding their workspace code. 
Your main responsibilities include examining issue information to 
analyze possible causes of the issue and determine the code that 
needs to be fixed.
Please refer to the above responsibilities and provide detailed 
reasoning and analysis. Then at the last line conclude "Thus the 
probability score that this code needs to be modified to solve this 
issue is s", where s is an integer between 1 and 10.
# Examples
Issue: ModelChain.prepare_inputs error, ...
Code:
```
def prepare_inputs_from_poa(self, data): ...
```
Thought: To solve the problem in the prepare_inputs(), ... 
Result:Thus the probability score that this code needs to be 
modified to solve this issue is 1.
# Now the issue is:
{issue}
Code:
```
# {method_type} method {method_name} in {rel_file_path} file.
{code_content}
```
Thought:
Result:
Thought: The provided code snippet is the `database_forwards` 
method of the `RenameModel` class. This method handles the ...
Consequently, to address the issue, modifications to the 
`database_forwards` method are needed to introduce checks ...
Given the direct correlation between the issue and the location of 
the behavior within the `database_forwards` method of the 
`RenameModel` operation, it's clear that changes to this code are 
required to resolve the raised concern.
Result: Thus the probability score that this code needs to be 
modified to solve this issue is 9.
Issue: ModelChain.prepare_inputs error, ...
Code:
```
def prepare_inputs_from_poa(self, data): ...
```
Thought: To solve the problem in the prepare_inputs(), ... 
Result: Thus the probability score that this code needs to be 
modified to solve this issue is 1.
Figure 2: Reward agent’s input prompt template and output
results, with some details omitted.
model to conduct in-depth reasoning based on the specific informa-
tion in the question and code snippets to evaluate the correlation of
leaf nodes. The reward function prompt template we designed (see
Figure 2) starts with a guided system prompt that clearly points out
the goals and responsibilities of the reward function. Then, through
a series of example combinations of <issue description, code snippets,
thinking process, results> , the input, output and reasoning chain
in the scoring process are demonstrated. Finally, the prompt ends
with a new set of issue descriptions and code snippets, at which
point the model is expected to learn the intermediate reasoning
steps from the given examples and output corresponding reward
scores. Finally, we only keep the nodes with a reward score of no
less than 6 and return their content and structural dependencies.

Conference acronym ’XX, June 03–05, 2018, Woodstock, NY Trovato et al.
Compared with traditional methods, our method reduces the
dependence on large amounts of labeled data. This is critical to
cope with diverse and evolving situations in software repository,
as traditional approaches may suffer from the limitations of labeled
data. Therefore, our method has better adaptability and accuracy
when resolving real-world software development environments.
Backpropagation & Reference Expansion. After the eval-
uation ends, we perform a bottom-up update from the terminal
node back to the root node. During this process, we update the visit
count 𝑛and the reward value 𝑤. In addition, we also introduced
reference relationship expansion in the backpropagation phase.
Different from the conventional expansion method, we not only
expand when we encounter leaf nodes, but also when we encounter
those nodes with higher reward scores (set the threshold to a re-
ward score of not less than 6 here), we will expand their reference
modules and objects based on the repository knowledge graph. And
then integrate them into new nodes. The insight is that in actual
development, the node called by the current node is often the key
node for function implementation, and the called node is usually
the use of the current node and depends on the implementation
and changes of the current node. Therefore, if a node has a higher
reward score, the nodes with calling relationships may also be rele-
vant. By expanding these calling relationship nodes, code snippets
related to the current issue can be captured more comprehensively.
3.4 Information Utilization & Patch Generation
At this stage, RepoUnderstander first summarizes the whole reposi-
tory experience, then obtains code snippet information dynamicly
on this basis, and finally generates patches that try to solve the
problem. The three steps are detailed below.
Repository Summary. To more effectively utilize the global
repository information collected during the repository understand-
ing phase, we introduce a summary agent. The agent aims to sys-
tematically analyze and summarize the code snippets collected in
the repository knowledge graph and submitted issues , and then
plan how to solve the problem, thereby forming an experience of
the entire repository. Specifically, the summary agent takes the
issue and the collected relevant code fragments as input, and then
outputs a summary of the relevant fragments in sequence and
plans a solution. The specific prompt template is shown in Figure
3. Since the collected global repository information may be com-
plex and contain a large number of code fragments and annotation
descriptions, we only use the location description of the relevant
code fragments (i.e., structural dependencies in the repository) and
the output of the Summary Agent (i.e., summary and planning)
as RepoUnderstander’s experience to guide subsequent actions.
This experience does not include specific function implementation,
but only focuses on overall repository experience guidance. The
location description is formalized as <file>a.py</file><class>Class
A</class><func>func a</func>, and the summary agent output is as
shown in Figure 3.
Dynamic information acquisition. Global experience infor-
mation is RepoUnderstander’s experience summary of relevant
information in the current workspace, which can help the lan-
guage model understand issues and find solutions more quickly.
In the process of solving problems, in order to make full use of
You are a senior software developer maintaining a large project. 
You are working on an issue submitted to your project. The issue 
contains a description marked between <issue> and </issue>.
We've collected some code snippets from the code repository that 
may be relevant.
To help diagnose and fix issues in repositories, let's systematically 
analyze the collected context step by step. 
<issue>
{issue_content}
</issue>
<collected content>
{collected_content}
</collected content>
Analyze results:
Based on the collected code snippets, here's the analysis of the 
migration process that's intended to update proxy model 
permissions:
1. The migration was introduced to update the `content_type` ...
2. The `update_proxy_model_permissions` function is designed ...
3. The `revert_proxy_model_permissions` function calls ...
4. The `Migration` class sets dependencies for this ...
Based on the description of the issue, it seems that so far:
- The error persists despite attempts to delete the ...
- The error has been encountered when updating from Django ...
- Clearing the virtual environment did not resolve the issue.
There are a few possible steps to fix the issue further:
- **Ensure the `content_type_id` and `codename` ...**
- **Examine the Proxy Models**.
- ** ... **
Figure 3: Summary agent’s input prompt template and output
results, with some details omitted.
this global experience information, RepoUnderstander futher needs
to dynamically extract local information from the current reposi-
tory, including specific classes, functions and code snippets in the
repository.
The ReAct [44] framework (i.e., Reson then Act) guides the model
to generate inference trajectories and task-specific actions in a stag-
gered manner, allowing the model to interact with the code repos-
itory and collect information. Specifically, the ReAct framework
first generates reasoning paths through the Chain-of-Thought [38],
and then outputs actual actions based on the reasoning results.
Therefore, by using ReAct method, RepoUnderstander can call the
corresponding search API according to task requirements and dy-
namically extract local information from the current repository to
collect relevant context. We follow AutoCodeRover’s search API
method [49], using the three-layer search method of search_class,
search_method, and search_code. Specifically, RepoUnderstander
first independently determines the API that needs to be called.
Then the retrieval API will search for classes, methods and code

How to Understand Whole Software Repository? Conference acronym ’XX, June 03–05, 2018, Woodstock, NY
snippets in the repository knowledge graph, and finally return the
results to the agent.
Patch Generation. In the patch generation step, RepoUnder-
stander first locates faults based on the summary of global experi-
ence and dynamic information, extracts the context of code snippets
that may need to be modified, and then generates modified code
snippets. Finally, a diff is generated based on the code snippet be-
fore modification and the code snippet after modification, and is
returned as the final result. If a diff is incorrect due to syntax, we
will retry until an applicable patch with correct syntax is generated.
We follow AutoCodeRover [49] and set the maximum number of
retries to 3 to ensure that the generated patch can be applied as
much as possible.
4 EXPERIMENT
To validate the performance of RepoUnderstander, we conduct
experiments and compare it with other LLMs and agents to demon-
strate its superiority (§4.2, §4.4). In addition, we found that there
is an information asymmetry problem in SWE-bench [19] caused
by new added function names and variable names in the test patch
(§4.3). We proposed issue patches to new feature types issues to
solve this problem and test agents on the new FIX version test set.
Finally, we systematically analyzed the problem-solving capabilities
of RepoUnderstander at different stages (§4.5).
4.1 Experimental Setup
Datasets. We evaluate on the SWE-bench Lite dataset [19] which
are constructed due to the high cost of evaluating in the complete
SWE-bench. SWE-bench Lite includes 300 task instances sampled
from SWE-bench, following a similar repository distribution. SWE-
bench team recommend future systems evaluating on SWE-bench
to report numbers on SWE-bench Lite in lieu of the full SWE-bench
set if necessary. SWE-bench Lite aims to provide a diverse set of
code base issues that can be verified using in-repository unit tests.
It requires LLM systems to generate corresponding patches based
on the actual issues in the repository, and then pass the tests.
Baselines. We compare RepoUnderstander with two types of
baselines. The first category is the RAG baselines [19]. This type of
baseline uses the BM25 method to retrieve code base files related
to the issue and inputs them into LLM to directly generate patch
files that solve the problem. The second type of baseline is the
agents baseline (i.e., AutoCodeRover [ 49] and SWE-agent [ 43]),
which locates the problem through complex multiple rounds of
interaction and execution feedback, and finally generates a patch
to solve the problem through iterative verification.
Metrics. Following the SWE-bench [19], We evaluate the effec-
tiveness of RepoUnderstander, using the percentage of resolved
instances and the patch application rate. Among them, the patch
application rate refers to the proportion of instances where code
changes are successfully generated and can be applied to existing
code bases using Git tools. Resolved ratio represents the overall
effectiveness of solving actual GitHub issues, and application ratio
reflects the intermediate results of patch availability.
Method Resolved Apply
RAG-based
SWE-Llama 7B 1.33% (4) 38.00%
SWE-Llama 13B 1.00% (3) 38.00%
ChatGPT-3.5 0.33% (1) 10.33%
GPT-4 2.67% (8) 29.67%
Claude-2 3.00% (9) 33.00%
Claude-3 Opus 4.33% (13) 51.67%
Agent-based
AutoCodeRover 16.11% (48) 83.00%
SWE-agent 18.00% (54) 93.00%
RepoUnderstander 21.33% (64) 85.67%
Table 1: Main results for RepoUnderstander performance on
the SWE-bench-lite test set. The numbers in brackets indicate
the number of issues solved.
Configurations. All results, ablations, and result analyzes of
RepoUnderstander use the GPT4-Turbo model (i.e., gpt-4-1106-
preview [1], the same model with SWE-agent [ 43]). We use ast2
and Jedi3 library to parse repository and obtain syntax structures
and dependencies of repository. In MCTS-Enhanced Repository
Understanding stage, we set the number of search iterations to 600
and maximum search time to 300 seconds. In information Utiliza-
tion & Patch Generation stage, we set the maximun number of
summary code snippets to 10. SWE-bench has a relatively complex
environment configuration. Thanks to the development of the open
source community, we use the well-build open source docker of
the AutoCodeRover [49] team for experiments.
4.2 Comparison Experiment
We first evaluate the effectiveness of RepoUnderstander in SWE-
bench Lite (300 instances). The performance comparison analysis
between RepoUnderstander and other methods is shown in Ta-
ble 1. In each instance, we provide a natural language description
from a real-world software engineering problem and a local code
repository of corresponding versions, asking the model to solve the
problem and generate patches that can pass local automated testing.
Resolved reflects the end-to-end ability of the current RAG LLM
system and Agent system to solve software engineering problems.
The results show that RepoUnderstander is significantly better than
other RAG and Agent systems, achieving SOTA performance on
the test set. Compared with the RAG system, our method improves
performance by nearly 5 times. Compared with the state-of-the-
art Agent system, we improve the accuracy of SWE-agent by
18.5%. These excellent performances demonstrate the advancement
of our approach. In addition, the Apply application rate indicates
the availability of generated patches. We found that Agent-based
systems all achieved high availability, while RAG-based systems
have lower availability, which proves that agent systems may be
2https://docs.python.org/3/library/ast.html
3https://github.com/davidhalter/jedi

Conference acronym ’XX, June 03–05, 2018, Woodstock, NY Trovato et al.
Solved by all 
methods:
25
Unique:
16
RepoUnderstander
AutoCodeRover
SWE-agent
Unique:
9
Unique:
13
RepoU & ACR:
11
RepoU & SWE-
agent:
12
ACR & SWE-agent:
3
Figure 4: Venn diagrams of resolved cases of RepoUnder-
stander, SWE-agent and AutoCodeRover.
Method Resolved Apply
ACR & SWE-agent 24.33% (73) 98.00%
RepoU & ACR 25.33% (76) 94.67%
RepoU & SWE-agent 26.67% (80) 99.67%
Table 2: Venn diagram analysis of our method and baselines.
an important means to automatically solve software engineering
tasks. SWE-agent has the highest Apply application rate due to the
introduction of its running feedback capability, which shows that
running feedback is an effective way. This paper focuses more on
the understanding of the entire repository information. We will
integrate running feedback in future work.
In addition, we also compared the issue-solving distribution
diagrams of three Agent-based methods, and the results are shown
in Figure 4. We found that our method is very complementary
to the SWE-agent method. The two methods jointly solved 80
examples, achieving a task resolved rate of 26.67% (see Table
2), which further illustrates the complementarity of our method and
the execution feedback method. We will provide a detail discussion
and combination of the two methods in future work.
4.3 Dataset Analysis & Fix
User issues usually include bug reports , feature requests , and en-
hancements, etc [ 22, 30, 31, 39]. In SWE-bench dataset [ 19], we
found that there is information asymmetry for issues of the fea-
ture request type, such as adding functions or adding parameter
definitions. Specifically, since the test patch contains the signature
information of the new features, and the LLM Agents input lacks
this interface specification information, the agent model may not
be able to correctly understand the full context of the problem.
Even if the logic of the generated patch is correct, errors may occur
Method Resolved Apply
SWE-bench-Lite
AutoCodeRover 16.11% (48) 83.00%
RepoUnderstander 21.33% (64) 85.67%
SWE-bench-Lite-FIX
AutoCodeRover 18.00% (54) 84.00%
RepoUnderstander 23.00% (69) 88.00%
Table 3: Results for RepoUnderstander performance on the
SWE-bench-Lite-FIX test set.
during testing. This information asymmetry may affect the perfor-
mance evaluation and practical application of the LLM agents. From
the perspective of software engineering practice, new features are
usually defined and specified in the system design document. In
actual development, the information of these new features should
be specified rather than inferred by the agent model. Therefore,
merging the new feature interface specification in the test patch
into the problem description can enable the agent model to bet-
ter understand the problem and reduce the impact of information
asymmetry.
We made a fix for the SWE-bench Lite dataset and proposed
a FIX version. Specifically, we integrated the new feature inter-
face specifications in the test patch into the problem description
through manual analysis, and guided the agent model to generate
patches based on the complete problem description. In total, we
fixed 45/300 instances in SWE-bench Lite. This method can bet-
ter reflect the reality in practice, reduce the problems caused by
information asymmetry, and thus improve the credibility and effec-
tiveness of automatic software engineering technology in practical
applications. As shown in Table 3, our experimental results show
that on the FIX version test set, the methods RepoUnderstander and
AutoCodeRover [49] have all improved, among which RepoUnder-
stander performs best, further demonstrating the superior perfor-
mance of RepoUnderstander. We look forward to subsequent agent
system work reporting their performance on the FIX version.
4.4 Ablation Study
4.4.1 Module Analysis. This ablation experiment aims to study
the effectiveness of RepoUnderstander’s global repository under-
standing component. (1) Remove MCTS & summary modules: Re-
poUnderstander has no prior knowledge of the repository structure
and functions, that is, it lacks empirical information about the whole
repository and can only locate relevant code snippets by search-
ing through limited information in the issue. (2) Remove only the
summary module: Only the signature and dependency structure of
relevant information in the repository obtained by MCTS are used
as global experience, and the summary and planning of information
are removed. This experiment aims to verify the effectiveness of the
summary agent, i.e., the importance of comprehensive summary
of repository information. (3) Add a review agent module: After
RepoUnderstander generates a patch that can be applied, in order
to simulate the code review process in the development process, a
static review of the patch by the review agent is added to discover

How to Understand Whole Software Repository? Conference acronym ’XX, June 03–05, 2018, Woodstock, NY
Method Resolved Apply
RepoUnderstander 21.33% (64) 85.67%
- w/o. summary 17.67% (53) 85.33%
- w/o. mcts & summary 16.00% (48) 80.33%
- w. review 18.33% (55) 87.67%
Table 4: Ablation results of RepoUnderstander.
possible defects in the newly generated code. If there is a defect, the
patch is regenerated according to the review reason until a patch
that passes the review is generated. This process is repeated up to
three times.
Our experimental results demonstrate the importance of global
experience and the effectiveness of the summary agent. As shown
in Table 4, removing these modules all resulted in a drop in the
performance of RepoUnderstander, especially after removing the
MCTS & summary agent; the number of problem instances solved
decreased from 64 to 48, which highlights the importance of global
experience for automatically solving repository-level issues. In addi-
tion, we found that after adding the review agent, the performance
of RepoUnderstander dropped, suggesting the limitations of static
review. We speculate that the LLM-based static review may only
rely on the surface grammatical information of the code and can-
not fully understand the semantic meaning of the code. Therefore,
the static review may ignore some hidden logical errors or illogi-
cal situations in the code. Therefore, we suggest that subsequent
work can combine dynamic program analysis [ 7, 41, 46] such as
program instrumentation [14, 16] to improve the reliability of the
LLM Agent.
4.4.2 Hyper Parameter Analysis. We further analyzed the impact
of the iterations number in MCTS. We set the maximum number of
iterations to 50, 200, and 600, and limited the maximum iteration
time to 300 seconds. The results are shown in Table 5. We found that:
(1) As the number of iterations increases, RepoUnderstander solves
more actual issues. This shows that as the number of iterations
rounds increases, agents will collect more repository information,
i.e., they will have more experience with the repository, resulting
in a higher problem solving rate; (2) As the number of iterations in-
creases, we found that the relative improvement in problem solving
gradually decreases. Specifically, the improvement of 50 iterations
is significant compared to no iterations, but the relative improve-
ment of the subsequent 200 and 600 iterations decreases. This may
be because in the early stage, agents can quickly search and summa-
rize relevant experience, but as the number of iterations increases,
the convergence speed of the model gradually slows down, and
the contribution of new information to performance improvement
becomes smaller; (3) We observed that as the number of iterations
increases from 200 to 600, the apply rate decreases. This phenome-
non indicates that as the number of iterations increases, the model
may be affected by some interference information when generat-
ing results, resulting in a decrease in the quality of the generated
results. Therefore, when selecting the number of iterations, it is nec-
essary to consider avoiding the influence of excessive interference
information.
Iters Resolved Apply
0 16.00% (48) 80.33%
50 19.67% (59) 86.67%
200 20.67% (62) 88.00%
600 21.33% (64) 85.67%
Table 5: Hyperparameter results of RepoUnderstander.
4.5 Case Study
4.5.1 Wrong Reason. Although RepoUnderstander achieved better
results than other methods in the ASE task, the task is still chal-
lenging (even when RepoUnderstander and SWE-agent worked
together, only 80/300 instances were fully automatically solved). To
guide the optimization of subsequent work, we analyzed the specific
reasons for the unsolved issues and divided the failure types into
three categories: wrong location, apply patch failed , and wrong patch.
Wrong location means that the agent did not locate the root cause
of the problem and mistakenly modified the code in other correct
locations. Apply patch failed means that the agent did not generate
a syntactically correct patch and could not be directly applied to the
existing version of the repository. Wrong patch means that when
the bug location and patch syntax are correct, the repaired code
cannot completely solve the problem, i.e., the test case does not
pass completely.
We compared the results of RepoUnderstander and the current
SOTA agent SWE-agent on SWE-bench Lite, as shown in the figure.
The results show that: (1) In terms of bug location, our method
generated patches in the wrong location in 45.0% of the tasks, while
SWE-agent generated patches in 62.0%. This shows that our method
performs better in correctly locating bugs, and the global experience
at the repository level plays a key role in fault location. (2) In terms
of patch applicability, our method did not generate patches in 13.7%
of the tasks, while SWE-agent generated 5.0%. (3) In terms of patch
correctness, our method generated incorrect patches in 20.0% of
the tasks, while SWE-agent generated 15.0%. These indicators show
that our method is more accurate in locating bug locations, but
has certain weaknesses in generating correct patches and ensuring
patch applicability. This may be because the execution feedback
module of SWE-agent allows the agent to iteratively generate and
verify the correctness of patches. This also shows the importance
of execution feedback for solving practical problems. Therefore,
by combining the global experience at the repository level and an
effective execution feedback mechanism, we can further optimize
the effect of automated software repair.
4.5.2 Resolved Tasks Study. To further analyze the performance of
RepoUnderstander in real-world problems, we selected two exam-
ples from SWE-bench (as shown in Figures 6 and 7) and compared
them with the SOTA solution, SWE-agent. By analyzing the ora-
cle patch, we determined the actual fault location that needs to
be modified. Among them, the green highlight indicates that the
agents correctly tracked the target that needs to be modified, and
the yellow highlight indicates that the agents incorrectly identified
the target that is not to be modified.

Conference acronym ’XX, June 03–05, 2018, Woodstock, NY Trovato et al.
13.7%
21.3%
45%
20.0%
Success
Apply patch  
failedWrong patch
Wrong location
5%
17.7%
62%
15%
Wrong location
Wrong patch
Success
Apply 
patch  
failed
Our Method SWE-agent
Figure 5: Distribution of results in SWE-bench Lite.
As shown in Figure 6, RepoUnderstander correctly explored
the issue-related function to be modified was_modified_since in
the MCTS-based Repository Exploration stage; in the subsequent
summary stage, it clearly pointed out that the function needed
to be updated; finally, under the guidance of global experience,
the agents accurately searched and located the was_modified_since
function in the dynamic information acquisition stage and the
patch generation stage, and successfully implemented the correct
modification. In contrast, in SWE-agent, agents can search for files
and view file contents in a fixed window size through computer
interface operations. However, due to the lack of guidance from
repositroy experience knowledge, SWE-agent mistakenly located
the function get_conditional_response in the local search. Although
this function has a certain relevance to solving the issue, it is not
directly related. Therefore, modifying the wrong place resulted in
the failure to solve the task.
In Figure 7, we analyzed and found that solving the matplotlib-
26011 task can be achieved by modifying the _set_lim or set_xlim
function. Both RepoUnderstander and SWE-agent correctly located
the position to be modified. However, due to the running feedback
and iteration capabilities of SWE-agent, the agents finally generated
the correct patch through feedback information. This shows the
importance of execution feedback for solving practical problems.
Since RepoUnderstander and SWE-agent have certain complemen-
tarity, in the future we will combine global experience and effective
execution feedback mechanism to further optimize the effect of
automated software repair.
5 LIMITATION
5.1 Resource Overhead.
Although RepoUnderstander aims to guide large language models
to fully understand the whole software repository to effectively
solve the challenges in automatic software engineering (ASE), the
Monte Carlo Tree Search (MCTS) process does require a certain
amount of resource consumption. Specifically, we set the maximum
number of iterations to 600 and the maximum search time to 300
seconds to ensure that the model can fully explore the search space
and accurately evaluate the rewards of different paths. However,
such settings are controllable and adjustable to adapt to different
application scenarios and resource constraints. Through reasonable
parameter adjustment, the best balance between resource consump-
tion and result accuracy can be found. In addition, as shown in
Table 5, only 50 iterations can also achieve results that are supe-
rior to other agents. Further research may discover more efficient
strategies to reduce resource requirements while maintaining or
improving agents performance.
5.2 Runtime feedback.
RepoUnderstander aims to study how to understand the entire
software repository, and has emerged effective ASE capabilities
through modules such as software knowledge graph construction
and MCTS-enhanced repository understanding, especially in tasks
such as fault location that rely on effective understanding of the
entire repository knowledge. SWE-agent [ 43] uses information
such as execution feedback to assist in verifying the correctness
of generated patches, and iteratively repairs patches to pass tests,
which has a certain effect on improving the correctness of patch
generation. In Table 2, we analyze the distribution of problem solv-
ing by RepoUnderstander and SWE-agent, and find that the two
methods have a certain complementarity, jointly solving 26.67%
of the problems on SWE-bench Lite. Inspired by this, in the future,
further combining RepoUnderstander with runtime feedback is an
effective way to enhance ASE capabilities.
6 CONCLUSION
This paper highlights the significance of understanding the whole
software repository as a critical path to achieving automatic soft-
ware engineering (ASE). To this end, we present a novel LLM-based
agent method named RepoUnderstander, which guides agents to
comprehensively understand entire repositories. Concretely, Re-
poUnderstander first constructs a repository knowledge graph to
condense extensive and complex repository-level information into a

How to Understand Whole Software Repository? Conference acronym ’XX, June 03–05, 2018, Woodstock, NY
RepoUnderstander
MCTS-based Repository Exploration:
<file>http.py</file><function>parse_http_date</function>
<file>static.py</file><function>was_modified_since</function>
<file>cache.py</file><function>get_conditional_response</function>
......
Summary:
Analyze:
1. In the code from `http.py`, the function `parse_http_date` is xxx.
2. The `was_modified_since` function in `static.py` checks if ...
3. ......
Plan:
- Determine what commit "d6aff369ad3" changed related to xxx.
- If the decision to raise an exception for an empty string ...
- Implement a check for empty strings before calling xxx
- Update the `was_modified_since` function to explicitly handle ...
- ......
Dynamic info. & Patch generation:
Search tool:
- search_code("d6aff369ad3")
- search_method_in_file("was_modified_since", "static.py")
- ......
Patch generation:
1. Buggy location is: func was_modified_since
2. Updated code: xxx
3. git diff & return diff.
SWE-agent:
- create reproduce_bug.py
- search_dir "d6aff369ad3"
- search_dir "If-Modified-Since"
- open django/middleware/http.py
- open django/utils/cache.py
- search_file "get_conditional_response"
- edit (<file>cache.py</file><func>get_conditional_response</func>)
- python reproduce_bug.py
- submit
Issue: Fix handling empty string for If-Modified-Since header.
Figure 6: Case of django-15498. (Partial wrokflow of Re-
poUnderstander and SWE-agent)
hierarchical structure. Subsequently, we enhance the agents’ repos-
itory understanding through a Monte Carlo Tree Search (MCTS)
enhanced repository exploration strategy. Finally, we guide the
agents to summarize, analyze, and plan according to global experi-
ences. Then, they can manipulate the tools to dynamically acquire
information and generate patches to solve real-world GitHub issues.
We demonstrate the superior performance of RepoUnderstander
through extensive experiments and comprehensive analyses. Our
method achieves state-of-the-art performance on the SWE-bench
Lite benchmark, outperforming existing RAG-based and agent-
based systems. Furthermore, we address the issue of information
asymmetry in the SWE-bench Lite dataset by proposing a FIX ver-
sion that integrates new feature interface specifications into the
problem description. Additionally, we conduct ablation studies to
RepoUnderstander
MCTS-based Repository Exploration:
<file>_base.py</file><class>_AxesBase</class><class_function>set_xli
m</class_function>
<file>axis.py</file><class>Axis</class><class_function>_set_lim</class
_function> ......
Summary:
Analyze:
1. In `set_xlim()`: It sets the limits of the x-axis and has an `emit` 
parameter ...
2. In `_set_lim()`: It similarly sets view limits and notifies observers ...
3. ...
Plan:
- Changing the hardcoded `emit=False` to `emit=True` would ...
- The recursion problem occurs because setting `emit=True` makes 
every shared axis call back into `_set_lim()` for all other shared axes, 
creating an endless loop.
Dynamic info. & Patch generation:
Search tool:
- search_class("_AxesBase")
- search_method_in_class("set_xlim", "_AxesBase")
- search_method_in_class("_set_lim", "Axis")
Patch generation:
1. Buggy location is: _set_lim
2. Updated code: xxx
3. git diff & return diff.
SWE-agent:
- create reproduce_bug.py
- find_file "_base.py"
- open lib/matplotlib/axes/_base.py
- search_file "def set_xlim"
- edit (<class>_AxesBase</class><class_function>set_xlim</class_function>)
- python reproduce_bug.py
- open lib/matplotlib/axes/_base.py
- edit  (<file>lib/matplotlib/axes/_base.py</file>) ......
- python reproduce_bug.py
- submit
Issue: xlim_changed not emitted on shared axis.
Figure 7: Case of matplotlib-26011. (Partial wrokflow of Re-
poUnderstander and SWE-agent)
analyze the effectiveness of various components of RepoUnder-
stander and identify areas for further improvement. Our findings
emphasize the importance of global repository experiences and
the potential benefits of integrating runtime feedback mechanisms.
Future work will focus on combining global experiences with run-
time feedback mechanisms to further enhance the capabilities of
LLM-based agents in solving complex software engineering tasks.
ACKNOWLEDGMENTS
To Robert, for the bagels and explaining CMYK and color spaces.
REFERENCES
[1] Josh Achiam, Steven Adler, Sandhini Agarwal, Lama Ahmad, Ilge Akkaya, Floren-
cia Leoni Aleman, Diogo Almeida, Janko Altenschmidt, Sam Altman, Shyamal

Conference acronym ’XX, June 03–05, 2018, Woodstock, NY Trovato et al.
Anadkat, et al. 2023. Gpt-4 technical report. arXiv preprint arXiv:2303.08774
(2023).
[2] Jacob Austin, Augustus Odena, Maxwell Nye, Maarten Bosma, Henryk
Michalewski, David Dohan, Ellen Jiang, Carrie Cai, Michael Terry, Quoc Le,
et al. 2021. Program synthesis with large language models. arXiv preprint
arXiv:2108.07732 (2021).
[3] Ramakrishna Bairi, Atharv Sonwane, Aditya Kanade, Arun Iyer, Suresh
Parthasarathy, Sriram Rajamani, B Ashok, Shashank Shet, et al. 2023. Codeplan:
Repository-level coding using llms and planning. arXiv preprint arXiv:2309.12499
(2023).
[4] Carlos E. Jimenez, John Yang, Jiayi Geng. 2024. Introducing SWE-bench Lite .
https://www.swebench.com/lite.html
[5] Mark Chen, Jerry Tworek, Heewoo Jun, Qiming Yuan, Henrique Ponde de
Oliveira Pinto, Jared Kaplan, Harri Edwards, Yuri Burda, Nicholas Joseph, Greg
Brockman, Alex Ray, Raul Puri, Gretchen Krueger, Michael Petrov, Heidy Khlaaf,
Girish Sastry, Pamela Mishkin, Brooke Chan, Scott Gray, Nick Ryder, Mikhail
Pavlov, Alethea Power, Lukasz Kaiser, Mohammad Bavarian, Clemens Winter,
Philippe Tillet, Felipe Petroski Such, Dave Cummings, Matthias Plappert, Fo-
tios Chantzis, Elizabeth Barnes, Ariel Herbert-Voss, William Hebgen Guss, Alex
Nichol, Alex Paino, Nikolas Tezak, Jie Tang, Igor Babuschkin, Suchir Balaji, Shan-
tanu Jain, William Saunders, Christopher Hesse, Andrew N. Carr, Jan Leike, Josh
Achiam, Vedant Misra, Evan Morikawa, Alec Radford, Matthew Knight, Miles
Brundage, Mira Murati, Katie Mayer, Peter Welinder, Bob McGrew, Dario Amodei,
Sam McCandlish, Ilya Sutskever, and Wojciech Zaremba. 2021. Evaluating Large
Language Models Trained on Code. (2021). arXiv:2107.03374 [cs.LG]
[6] Cognition. 2023. Introducing Devin. https://www.cognition.ai/introducing-devin
[7] Yinlin Deng, Chunqiu Steven Xia, Haoran Peng, Chenyuan Yang, and Lingming
Zhang. 2023. Large language models are zero-shot fuzzers: Fuzzing deep-learning
libraries via large language models. In Proceedings of the 32nd ACM SIGSOFT
international symposium on software testing and analysis . 423–435.
[8] Yangruibo Ding, Marcus J Min, Gail Kaiser, and Baishakhi Ray. 2024. CYCLE:
Learning to Self-Refine the Code Generation. Proceedings of the ACM on Pro-
gramming Languages 8, OOPSLA1 (2024), 392–418.
[9] Yangruibo Ding, Zijian Wang, Wasi Ahmad, Hantian Ding, Ming Tan, Nihal Jain,
Murali Krishna Ramanathan, Ramesh Nallapati, Parminder Bhatia, Dan Roth,
et al. 2024. Crosscodeeval: A diverse and multilingual benchmark for cross-file
code completion. Advances in Neural Information Processing Systems 36 (2024).
[10] Yangruibo Ding, Zijian Wang, Wasi Uddin Ahmad, Murali Krishna Ramanathan,
Ramesh Nallapati, Parminder Bhatia, Dan Roth, and Bing Xiang. 2022. Cocomic:
Code completion by jointly modeling in-file and cross-file context. arXiv preprint
arXiv:2212.10007 (2022).
[11] Qingxiu Dong, Lei Li, Damai Dai, Ce Zheng, Zhiyong Wu, Baobao Chang, Xu
Sun, Jingjing Xu, and Zhifang Sui. 2022. A survey on in-context learning. arXiv
preprint arXiv:2301.00234 (2022).
[12] Xueying Du, Mingwei Liu, Kaixin Wang, Hanlin Wang, Junwei Liu, Yixuan Chen,
Jiayi Feng, Chaofeng Sha, Xin Peng, and Yiling Lou. 2024. Evaluating large
language models in class-level code generation. In Proceedings of the IEEE/ACM
46th International Conference on Software Engineering . 1–13.
[13] Daya Guo, Qihao Zhu, Dejian Yang, Zhenda Xie, Kai Dong, Wentao Zhang,
Guanting Chen, Xiao Bi, Y Wu, YK Li, et al. 2024. DeepSeek-Coder: When the
Large Language Model Meets Programming–The Rise of Code Intelligence.arXiv
preprint arXiv:2401.14196 (2024).
[14] Jeffrey K Hollingsworth, Barton Paul Miller, and Jon Cargille. 1994. Dynamic
program instrumentation for scalable performance tools. In Proceedings of IEEE
Scalable High Performance Computing Conference . IEEE, 841–850.
[15] Sirui Hong, Xiawu Zheng, Jonathan Chen, Yuheng Cheng, Jinlin Wang, Ceyao
Zhang, Zili Wang, Steven Ka Shing Yau, Zijuan Lin, Liyang Zhou, et al . 2023.
Metagpt: Meta programming for multi-agent collaborative framework. arXiv
preprint arXiv:2308.00352 (2023).
[16] JC Huang. 1978. Program instrumentation and software testing. Computer 11, 4
(1978), 25–32.
[17] Hamel Husain, Ho-Hsiang Wu, Tiferet Gazit, Miltiadis Allamanis, and Marc
Brockschmidt. 2019. Codesearchnet challenge: Evaluating the state of semantic
code search. arXiv preprint arXiv:1909.09436 (2019).
[18] Yoichi Ishibashi and Yoshimasa Nishimura. 2024. Self-Organized Agents: A
LLM Multi-Agent Framework toward Ultra Large-Scale Code Generation and
Optimization. arXiv preprint arXiv:2404.02183 (2024).
[19] Carlos E Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press,
and Karthik R Narasimhan. 2024. SWE-bench: Can Language Models Resolve
Real-world Github Issues?. In The Twelfth International Conference on Learning
Representations. https://openreview.net/forum?id=VTF8yNQM66
[20] Levente Kocsis and Csaba Szepesvári. 2006. Bandit based monte-carlo planning.
In European conference on machine learning . Springer, 282–293.
[21] Jiaolong Kong, Mingfei Cheng, Xiaofei Xie, Shangqing Liu, Xiaoning Du, and Qi
Guo. 2024. ContrastRepair: Enhancing Conversation-Based Automated Program
Repair via Contrastive Test Case Pairs. arXiv preprint arXiv:2403.01971 (2024).
[22] Rahul Krishna, Amritanshu Agrawal, Akond Rahman, Alexander Sobran, and
Tim Menzies. 2018. What is the connection between issues, bugs, and enhance-
ments? Lessons learned from 800+ software projects. In Proceedings of the 40th
international conference on software engineering: Software engineering in practice .
306–315.
[23] Cheryl Lee, Chunqiu Steven Xia, Jen-tse Huang, Zhouruixin Zhu, Lingming
Zhang, and Michael R Lyu. 2024. A Unified Debugging Approach via LLM-Based
Multi-Agent Synergy. arXiv preprint arXiv:2404.17153 (2024).
[24] Ming Liang, Xiaoheng Xie, Gehao Zhang, Xunjin Zheng, Peng Di, Hongwei Chen,
Chengpeng Wang, Gang Fan, et al. 2024. REPOFUSE: Repository-Level Code
Completion with Fused Dual Context. arXiv preprint arXiv:2402.14323 (2024).
[25] Jiawei Liu, Chunqiu Steven Xia, Yuyao Wang, and Lingming Zhang. 2024. Is your
code generated by chatgpt really correct? rigorous evaluation of large language
models for code generation. Advances in Neural Information Processing Systems
36 (2024).
[26] Tianyang Liu, Canwen Xu, and Julian McAuley. 2023. Repobench: Benchmarking
repository-level code auto-completion systems. arXiv preprint arXiv:2306.03091
(2023).
[27] Anton Lozhkov, Raymond Li, Loubna Ben Allal, Federico Cassano, Joel Lamy-
Poirier, Nouamane Tazi, Ao Tang, Dmytro Pykhtar, Jiawei Liu, Yuxiang Wei,
et al. 2024. StarCoder 2 and The Stack v2: The Next Generation. arXiv preprint
arXiv:2402.19173 (2024).
[28] Shuai Lu, Daya Guo, Shuo Ren, Junjie Huang, Alexey Svyatkovskiy, Ambro-
sio Blanco, Colin Clement, Dawn Drain, Daxin Jiang, Duyu Tang, et al . 2021.
Codexglue: A machine learning benchmark dataset for code understanding and
generation. arXiv preprint arXiv:2102.04664 (2021).
[29] Qinyu Luo, Yining Ye, Shihao Liang, Zhong Zhang, Yujia Qin, Yaxi Lu, Yesai Wu,
Xin Cong, Yankai Lin, Yingli Zhang, et al. 2024. RepoAgent: An LLM-Powered
Open-Source Framework for Repository-level Code Documentation Generation.
arXiv preprint arXiv:2402.16667 (2024).
[30] Thorsten Merten, Matúš Falis, Paul Hübner, Thomas Quirchmayr, Simone Bürsner,
and Barbara Paech. 2016. Software feature request detection in issue tracking
systems. In 2016 IEEE 24th international requirements engineering conference (RE) .
IEEE, 166–175.
[31] Moran Altarac. 2024. Mastering Bug Reporting and Feedback Collection: A Com-
prehensive Guide. https://www.guidde.com/blog/mastering-bug-reporting-and-
feedback-collection-a-comprehensive-guide
[32] OpenDevin. 2023. OpenDevin. https://github.com/OpenDevin/OpenDevin
[33] Yihao Qin, Shangwen Wang, Yiling Lou, Jinhao Dong, Kaixin Wang, Xiaoling Li,
and Xiaoguang Mao. 2024. AgentFL: Scaling LLM-based Fault Localization to
Project-Level Context. arXiv preprint arXiv:2403.16362 (2024).
[34] Zeeshan Rasheed, Muhammad Waseem, Mika Saari, Kari Systä, and Pekka Abra-
hamsson. 2024. Codepori: Large scale model for autonomous software develop-
ment by using multi-agents. arXiv preprint arXiv:2402.01411 (2024).
[35] Disha Shrivastava, Hugo Larochelle, and Daniel Tarlow. 2023. Repository-level
prompt generation for large language models of code. In International Conference
on Machine Learning . PMLR, 31693–31715.
[36] Daniel Tang, Zhenghan Chen, Kisub Kim, Yewei Song, Haoye Tian, Saad Ezzini,
Yongfeng Huang, and Jacques Klein Tegawende F Bissyande. 2024. Collaborative
agents for software engineering. arXiv preprint arXiv:2402.02172 (2024).
[37] Xingyao Wang, Yangyi Chen, Lifan Yuan, Yizhe Zhang, Yunzhu Li, Hao
Peng, and Heng Ji. 2024. Executable Code Actions Elicit Better LLM Agents.
arXiv:2402.01030 [cs.CL]
[38] Jason Wei, Xuezhi Wang, Dale Schuurmans, Maarten Bosma, Fei Xia, Ed Chi,
Quoc V Le, Denny Zhou, et al. 2022. Chain-of-thought prompting elicits reasoning
in large language models. Advances in neural information processing systems 35
(2022), 24824–24837.
[39] wiki koha. 2024. Bug Reporting Guidelines . https://wiki.koha-community.org/
wiki/Bug_Reporting_Guidelines
[40] What Makes In-Context Learning Work. [n. d.]. Rethinking the Role of Demon-
strations: What Makes In-Context Learning Work? ([n. d.]).
[41] Chunqiu Steven Xia, Matteo Paltenghi, Jia Le Tian, Michael Pradel, and Lingming
Zhang. 2024. Fuzz4all: Universal fuzzing with large language models. In Pro-
ceedings of the IEEE/ACM 46th International Conference on Software Engineering .
1–13.
[42] Yutao Xie, Jiayi Lin, Hande Dong, Lei Zhang, and Zhonghai Wu. 2023. Survey of
code search based on deep learning. ACM Transactions on Software Engineering
and Methodology 33, 2 (2023), 1–42.
[43] John Yang, Carlos E Jimenez, Alexander Wettig, Kilian Lieret, Shunyu Yao, Karthik
Narasimhan, and Ofir Press. [n. d.]. SWE-AGENT: AGENT-COMPUTER INTER-
FACES ENABLE AUTOMATED SOFTWARE ENGINEERING. ([n. d.]).
[44] Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan,
and Yuan Cao. 2022. React: Synergizing reasoning and acting in language models.
arXiv preprint arXiv:2210.03629 (2022).
[45] Daoguang Zan, Bei Chen, Yongshun Gong, Junzhi Cao, Fengji Zhang, Bingchao
Wu, Bei Guan, Yilong Yin, and Yongji Wang. 2023. Private-library-oriented code
generation with large language models. arXiv preprint arXiv:2307.15370 (2023).

How to Understand Whole Software Repository? Conference acronym ’XX, June 03–05, 2018, Woodstock, NY
[46] Cen Zhang, Mingqiang Bai, Yaowen Zheng, Yeting Li, Xiaofei Xie, Yuekang Li,
Wei Ma, Limin Sun, and Yang Liu. 2023. Understanding large language model
based fuzz driver generation. arXiv preprint arXiv:2307.12469 (2023).
[47] Fengji Zhang, Bei Chen, Yue Zhang, Jacky Keung, Jin Liu, Daoguang Zan, Yi Mao,
Jian-Guang Lou, and Weizhu Chen. 2023. Repocoder: Repository-level code com-
pletion through iterative retrieval and generation.arXiv preprint arXiv:2303.12570
(2023).
[48] Kechi Zhang, Jia Li, Ge Li, Xianjie Shi, and Zhi Jin. 2024. CodeAgent: Enhancing
Code Generation with Tool-Integrated Agent Systems for Real-World Repo-level
Coding Challenges. arXiv preprint arXiv:2401.07339 (2024).
[49] Yuntong Zhang, Haifeng Ruan, Zhiyu Fan, and Abhik Roychoudhury.
2024. AutoCodeRover: Autonomous Program Improvement. arXiv preprint
arXiv:2404.05427 (2024).
[50] Qinkai Zheng, Xiao Xia, Xu Zou, Yuxiao Dong, Shan Wang, Yufei Xue, Lei Shen,
Zihan Wang, Andi Wang, Yang Li, et al. 2023. Codegeex: A pre-trained model for
code generation with multilingual benchmarking on humaneval-x. InProceedings
of the 29th ACM SIGKDD Conference on Knowledge Discovery and Data Mining .
5673–5684.