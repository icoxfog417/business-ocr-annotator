# CloudFormation Stack Dependency Overview

This document visualizes the Amplify Gen2 nested stack architecture and cross-stack dependencies.
Keeping this up-to-date helps avoid circular dependency errors when modifying `backend.ts` or `resource.ts`.

## Stack Overview

```mermaid
graph TB
    subgraph ROOT["Root Stack (Amplify Gen2)"]

        subgraph AUTH["Auth Stack"]
            CognitoUserPool["Cognito User Pool<br/>(Google OAuth)"]
        end

        subgraph STORAGE["Storage Stack"]
            S3Bucket["S3 Bucket<br/>(businessOcrImages)"]
            ProcessImage["processImage Lambda<br/>(Node.js, S3-triggered)"]
        end

        subgraph DATA["Data Stack"]
            direction TB
            subgraph Tables["DynamoDB Tables"]
                AnnotationTable["Annotation"]
                ImageTable["Image"]
                EvalJobTable["EvaluationJob"]
                DatasetVersionTable["DatasetVersion"]
                ExportProgressTable["DatasetExportProgress"]
                DefaultQuestionTable["DefaultQuestion"]
            end
            SSMParam["SSM Parameter<br/>/business-ocr/tables/{bucket}/image-table-name"]
            AppSync["AppSync GraphQL API"]
            GenAnnotation["generateAnnotationHandler<br/>(Node.js)"]
            ExportHandler["exportDatasetHandler<br/>(Node.js dispatcher)"]
            TriggerEval["triggerEvaluationHandler<br/>(Node.js)"]
            GetCounts["getAnnotationCountsHandler<br/>(Node.js)"]
        end

        subgraph FUNCTION["Function Stack"]
            ExportDataset["exportDataset Lambda<br/>(Python, CDK Function)"]
            RunEval["runEvaluation Lambda<br/>(Python, CDK Function)"]
            SQSQueue["EvaluationJobs Queue<br/>(SQS)"]
            SQSDLQ["EvaluationJobs DLQ<br/>(SQS)"]
        end

    end
```

## Cross-Stack Dependencies

```mermaid
graph LR
    subgraph DATA["Data Stack"]
        ExportHandler["exportDatasetHandler"]
        TriggerEval["triggerEvaluationHandler"]
        GetCounts["getAnnotationCountsHandler"]
        Tables["DynamoDB Tables"]
    end

    subgraph FUNCTION["Function Stack"]
        ExportDataset["exportDataset<br/>(Python)"]
        RunEval["runEvaluation<br/>(Python)"]
        SQS["SQS Queue"]
    end

    subgraph STORAGE["Storage Stack"]
        S3["S3 Bucket"]
        ProcessImage["processImage"]
    end

    %% DATA → FUNCTION (one-way, safe)
    ExportHandler -- "invoke + functionName<br/>(env var + grantInvoke)" --> ExportDataset
    TriggerEval -- "queueUrl<br/>(env var + grantSendMessages)" --> SQS
    SQS -- "SQS event source" --> RunEval

    %% STORAGE → FUNCTION (one-way via S3 trigger)
    S3 -- "S3 event notification" --> ProcessImage

    %% Table names flow (runtime, NOT CDK tokens)
    ExportHandler -. "table names<br/>(event payload)" .-> ExportDataset
    TriggerEval -. "table name<br/>(SQS message)" .-> RunEval
    ProcessImage -. "SSM Parameter<br/>(bucket→table lookup)" .-> Tables

    %% Within DATA stack (safe, same stack)
    Tables -- "CDK tokens<br/>(addPropertyOverride)" --> GetCounts
    Tables -- "CDK tokens<br/>(addPropertyOverride)" --> TriggerEval
    Tables -- "CDK tokens<br/>(addPropertyOverride)" --> ExportHandler

    style DATA fill:#e1f5fe
    style FUNCTION fill:#fff3e0
    style STORAGE fill:#e8f5e9
```

## How Table Names Reach Each Lambda

```mermaid
flowchart TD
    CDK["backend.data.resources.tables<br/>(CDK deploy-time tokens)"]

    subgraph SAFE["✅ Same Stack (data) — No circular dependency"]
        GetCounts["getAnnotationCountsHandler<br/>env: ANNOTATION_TABLE_NAME<br/>env: IMAGE_TABLE_NAME"]
        TriggerEval["triggerEvaluationHandler<br/>env: EVALUATION_JOB_TABLE_NAME"]
        ExportHandler["exportDatasetHandler<br/>env: ANNOTATION_TABLE_NAME<br/>env: IMAGE_TABLE_NAME<br/>env: DATASET_VERSION_TABLE_NAME<br/>env: DATASET_EXPORT_PROGRESS_TABLE_NAME"]
    end

    subgraph PAYLOAD["✅ Via Runtime Payload — Avoids circular dependency"]
        ExportDataset["exportDataset (Python)<br/>← event.tableNames"]
        RunEval["runEvaluation (Python)<br/>← message.evaluationJobTableName"]
    end

    subgraph SSM["✅ SSM Parameter Store — Environment-safe"]
        ProcessImage["processImage<br/>SSM param (bucket→table)"]
    end

    CDK -- "addPropertyOverride" --> GetCounts
    CDK -- "addPropertyOverride" --> TriggerEval
    CDK -- "addPropertyOverride" --> ExportHandler
    ExportHandler -- "Lambda invoke payload" --> ExportDataset
    TriggerEval -- "SQS message body" --> RunEval
    ProcessImage -. "SSM GetParameter" .-> SSMParam["SSM Parameter Store<br/>/business-ocr/tables/{bucket}/image-table-name"]

    style SAFE fill:#c8e6c9
    style PAYLOAD fill:#fff9c4
    style SSM fill:#c8e6c9
```

## Rules to Avoid Circular Dependencies

### The Fundamental Constraint

```
If DATA stack references FUNCTION stack (e.g., data resolvers invoke Lambdas),
then FUNCTION stack MUST NOT reference DATA stack (e.g., table CDK tokens).
```

### Decision Tree for Passing Table Names

```mermaid
flowchart TD
    Q1{"Is the Lambda a data resolver<br/>or in the data stack?"}
    Q1 -- "Yes" --> A1["✅ Use addPropertyOverride<br/>with table CDK tokens<br/>(same stack, safe)"]
    Q1 -- "No" --> Q2{"Does a data-stack Lambda<br/>invoke this Lambda?"}
    Q2 -- "Yes" --> A2["✅ Pass table names in<br/>event payload / SQS message<br/>from the data-stack caller"]
    Q2 -- "No" --> A3["✅ Use SSM Parameter Store<br/>CDK writes param at deploy time<br/>Lambda reads at runtime<br/>(no CDK cross-stack ref)"]

    style A1 fill:#c8e6c9
    style A2 fill:#fff9c4
    style A3 fill:#c8e6c9
```

### Checklist When Adding New Lambdas

1. **Data resolver functions** (referenced in `a.handler.function(...)` in schema):
   - Add `resourceGroupName: 'data'` to `defineFunction` options
   - Can use `addPropertyOverride` with `backend.data.resources.tables` tokens
   - Can use `table.tableArn` in IAM policies

2. **Function-stack Lambdas** invoked by data-stack dispatchers:
   - **DO NOT** use `addEnvironment` or `addPropertyOverride` with table CDK tokens
   - **DO** receive table names via event payload or SQS message from the data-stack caller
   - **DO** use wildcard ARN strings for IAM policies (`'arn:aws:dynamodb:*:*:table/MyTable-*'`)

3. **Function-stack Lambdas** with no data-stack intermediary (e.g., S3-triggered):
   - Cannot use CDK table tokens at all
   - Use SSM Parameter Store: CDK writes the parameter (in the data stack where both
     the bucket token and table token are available), Lambda reads it at runtime
   - See `processImage` for the reference implementation

### What Creates Cross-Stack References

| Pattern | Creates cross-stack ref? |
|---------|--------------------------|
| `table.tableName` in `addPropertyOverride` | **Yes** — CDK token resolves to `Fn::GetAtt` across stacks |
| `table.tableArn` in IAM policy `resources` | **Yes** — same mechanism |
| `lambda.addEnvironment('KEY', table.tableName)` | **Yes** — same mechanism |
| `'arn:aws:dynamodb:*:*:table/Prefix-*'` string in IAM | **No** — plain string, no token |
| Passing table name in Lambda invoke payload at runtime | **No** — runtime data flow, invisible to CDK |
| SSM Parameter (CDK writes in data stack, Lambda reads at runtime) | **No** — parameter created in same stack as table; Lambda only reads at runtime |

---

**Last Updated**: 2026-01-31
