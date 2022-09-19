#!/bin/bash
# パイプラインの実行ログの最新から承認コメントを取得してリポジトリにタグを打つスクリプト
# 承認コメントはリリース課題の ID を想定
set -eu

git config --global credential.helper '!aws codecommit credential-helper $@'
git config --global credential.UseHttpPath true

ls
ls .git

EXECUTION_ID=`aws codepipeline list-pipeline-executions --pipeline-name $PIPELINE_NAME | jq -r ".pipelineExecutionSummaries[0].pipelineExecutionId"`
echo "EXECUTION_ID: ${EXECUTION_ID}"

LOG=`aws codepipeline list-action-executions --pipeline-name $PIPELINE_NAME --filter pipelineExecutionId=$EXECUTION_ID`
echo $LOG

RELEASE_ID=`aws codepipeline list-action-executions --pipeline-name $PIPELINE_NAME --filter pipelineExecutionId=$EXECUTION_ID | jq -r '.actionExecutionDetails[] | select( .actionName | contains("ReleaseApproval")).output.executionResult.externalExecutionSummary'`
echo "RELEASE_ID: $RELEASE_ID"

if [ -n "$RELEASE_ID" ]; then
    git checkout master
    git tag $RELEASE_ID
    git push origin $RELEASE_ID
else
   echo 'no release id'
   exit 1
fi
